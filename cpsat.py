"""
cpsat.py — OR-Tools CP-SAT Solver  (2-room model, streaming-capable)
=====================================================================

The solver supports two modes:
  1. optimize(snapshot) → dict          — blocking, returns final result
  2. optimize_stream(snapshot, cb)      — calls cb(partial_snapshot, score, elapsed)
                                          each time a better solution is found,
                                          then calls cb(final_snapshot, score, elapsed, done=True)

The streaming callback receives a *copy* of the snapshot with the current
best placements — safe to serialise and send over SSE.
"""

from __future__ import annotations

import copy
import time
from collections import defaultdict
from datetime import date
from math import ceil

try:
    from ortools.sat.python import cp_model
    _ORTOOLS = True
except ImportError:
    _ORTOOLS = False

TIME_LIMIT_SEC = 30.0
NUM_WORKERS    = 8
NUM_ROOMS      = 2


# ═══════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════

def optimize(snapshot, time_limit=TIME_LIMIT_SEC, warm_start_snapshot=None):
    """
    Blocking solve.
    warm_start_snapshot: if provided (e.g. a previous fast-solve result),
    its placements are used as AddHint to seed CP-SAT immediately from a
    known feasible point rather than searching from scratch.
    """
    if _ORTOOLS:
        return _cpsat_solve(snapshot, callback=None,
                            time_limit=time_limit,
                            warm_start_snapshot=warm_start_snapshot)
    return _greedy_solve(snapshot)


def optimize_stream(snapshot, callback, time_limit=TIME_LIMIT_SEC,
                    warm_start_snapshot=None):
    """
    Streaming solve.
    callback(snap_copy, score, elapsed_s, done=False) fires on each
    improving solution, then once with done=True for the final result.
    warm_start_snapshot: seeds CP-SAT from an existing feasible solution
    so the deep-solve never has to re-discover feasibility from scratch.
    """
    if _ORTOOLS:
        return _cpsat_solve(snapshot, callback=callback,
                            time_limit=time_limit,
                            warm_start_snapshot=warm_start_snapshot)
    result  = _greedy_solve(snapshot)
    score   = result["metrics"].get("score", 0)
    elapsed = result["metrics"].get("solve_seconds", 0)
    callback(copy.deepcopy(result), score, elapsed, done=True)
    return result


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _weekend_mask(start_date_str, window_days, allow_sat, allow_sun):
    forbidden = set()
    if allow_sat and allow_sun:
        return forbidden
    weekday0 = 0
    if start_date_str:
        try:
            y, m, d = map(int, start_date_str.split("-"))
            weekday0 = date(y, m, d).weekday()
        except Exception:
            pass
    for d in range(window_days):
        dow = (weekday0 + d) % 7
        if dow == 5 and not allow_sat:
            forbidden.add(d)
        if dow == 6 and not allow_sun:
            forbidden.add(d)
    return forbidden


def _build_course_index(placements):
    courses = {}
    for p in placements:
        cid = p["course_id"]
        if cid not in courses:
            courses[cid] = {"duration_slots": p["duration_slots"], "employees": []}
        eid = p["employee_id"]
        if eid not in courses[cid]["employees"]:
            courses[cid]["employees"].append(eid)
    return courses


def _write_metrics(placements, orig_emp_days, snapshot, elapsed, label, max_classroom):
    opt_emp_days = defaultdict(set)
    for p in placements:
        if not p.get("overflow"):
            opt_emp_days[p["employee_id"]].add(p["day_index"])

    orig_total = sum(len(v) for v in orig_emp_days.values())
    opt_total  = sum(len(v) for v in opt_emp_days.values())

    compression = 0
    if orig_total > 0:
        compression = max(0, min(99, round((orig_total - opt_total) / orig_total * 100)))

    total_placements     = len(placements)
    overflow_count       = sum(1 for p in placements if p.get("overflow"))
    scheduled_placements = total_placements - overflow_count

    # True readiness: what fraction of training was successfully scheduled
    readiness = round((scheduled_placements / total_placements) * 100) if total_placements > 0 else 0

    course_data = _build_course_index(placements)
    oversized   = sum(1 for cd in course_data.values() if len(cd["employees"]) > max_classroom)

    m = snapshot.setdefault("metrics", {})
    m["compression_percent"]  = compression
    m["score"]                = readiness          # true readiness 0–100
    m["solver"]               = label
    m["solve_seconds"]        = round(elapsed, 3)
    m["overflow_count"]       = overflow_count
    m["total_placements"]     = total_placements
    m["scheduled_placements"] = scheduled_placements
    m["oversized_courses"]    = oversized
    snapshot["phase"]         = "optimized"


def _assign_rooms(session_vars, session_plan, course_data, S, solver, num_rooms=2):
    events = []
    for (cid, s_idx), (d_var, s_var) in session_vars.items():
        day   = solver.Value(d_var)
        start = solver.Value(s_var)
        dur   = course_data[cid]["duration_slots"]
        events.append((day * S + start, dur, cid, s_idx))
    events.sort()

    room_end     = [-1] * num_rooms
    session_room = {}
    for gs, dur, cid, s_idx in events:
        r = min(range(num_rooms), key=lambda x: room_end[x])
        session_room[(cid, s_idx)] = r
        room_end[r] = gs + dur
    return session_room


def _apply_solution(placements, session_vars, session_plan, course_data, S, solver,
                    orig_emp_days, snapshot, elapsed, label, max_cls, num_rooms=2):
    """Extract current solver values and write them into snapshot placements."""
    session_room = _assign_rooms(session_vars, session_plan, course_data, S, solver, num_rooms)
    assignment   = {}
    for (cid, s_idx), (d_var, s_var) in session_vars.items():
        day   = solver.Value(d_var)
        start = solver.Value(s_var)
        room  = session_room.get((cid, s_idx), 0)
        for eid in session_plan[cid][s_idx]:
            assignment[(eid, cid)] = (day, start, room)

    for p in placements:
        key = (p["employee_id"], p["course_id"])
        if key in assignment:
            p["day_index"]  = assignment[key][0]
            p["start_slot"] = assignment[key][1]
            p["room"]       = assignment[key][2]
            p["overflow"]   = False
        else:
            p["overflow"] = True
            p["room"]     = 0

    _write_metrics(placements, orig_emp_days, snapshot, elapsed, label, max_cls)


# ═══════════════════════════════════════════════════════════════════════════
# Greedy fallback
# ═══════════════════════════════════════════════════════════════════════════

def _greedy_solve(snapshot):
    t0         = time.monotonic()
    placements = snapshot["placements"]
    tm         = snapshot["time_model"]
    W          = tm["training_window_days"]
    S          = tm["slots_per_day"]
    meta       = snapshot.get("constraints_meta", {})
    max_cls    = meta.get("max_classroom", 999)

    orig_emp_days = defaultdict(set)
    for p in placements:
        orig_emp_days[p["employee_id"]].add(p["day_index"])
        p["overflow"] = False
        p["room"]     = 0

    by_emp = defaultdict(list)
    for p in placements:
        by_emp[p["employee_id"]].append(p)

    for emp_id, eps in by_emp.items():
        eps.sort(key=lambda x: x["duration_slots"], reverse=True)
        day, ptr = 0, 0
        for p in eps:
            placed = False
            while day < W:
                if ptr + p["duration_slots"] <= S:
                    p["day_index"]  = day
                    p["start_slot"] = ptr
                    ptr += p["duration_slots"]
                    placed = True
                    break
                day += 1
                ptr  = 0
            if not placed:
                p["overflow"] = True

    _write_metrics(placements, orig_emp_days, snapshot,
                   time.monotonic() - t0, "greedy_fallback", max_cls)
    return snapshot


# ═══════════════════════════════════════════════════════════════════════════
# CP-SAT Solution Callback — fires on each improved solution
# ═══════════════════════════════════════════════════════════════════════════

class _StreamCallback(cp_model.CpSolverSolutionCallback):
    def __init__(self, session_vars, session_plan, course_data, S,
                 placements, orig_emp_days, snapshot, max_cls, t0, user_cb, num_rooms=2):
        super().__init__()
        self._sv           = session_vars
        self._sp           = session_plan
        self._cd           = course_data
        self._S            = S
        self._placements   = placements
        self._orig         = orig_emp_days
        self._snap         = snapshot
        self._max_cls      = max_cls
        self._t0           = t0
        self._user_cb      = user_cb
        self._best_obj     = float("inf")
        self._num_rooms    = num_rooms

    def on_solution_callback(self):
        obj = self.ObjectiveValue()
        if obj >= self._best_obj:
            return
        self._best_obj = obj
        elapsed = time.monotonic() - self._t0

        # Build a deep copy so the background solve loop doesn't race with SSE
        snap_copy   = copy.deepcopy(self._snap)
        placements  = snap_copy["placements"]
        session_vars_copy = {k: v for k, v in self._sv.items()}

        _apply_solution(
            placements, session_vars_copy, self._sp, self._cd,
            self._S, self, self._orig, snap_copy,
            elapsed, "cpsat_intermediate", self._max_cls, self._num_rooms
        )
        score = snap_copy["metrics"].get("score", 40)
        try:
            self._user_cb(snap_copy, score, elapsed, done=False)
        except Exception:
            pass  # never crash the solver


# ═══════════════════════════════════════════════════════════════════════════
# CP-SAT Solver
# ═══════════════════════════════════════════════════════════════════════════

def _cpsat_solve(snapshot, callback, time_limit=TIME_LIMIT_SEC,
                 warm_start_snapshot=None):
    """
    Core CP-SAT solver.

    Constraints
    -----------
    1. Room capacity: at most num_rooms sessions run concurrently.
    2. Employee no-overlap: no employee attends two sessions at the same time.

    Warm start
    ----------
    If warm_start_snapshot is provided (the result of a previous fast solve),
    its placements are used as model hints.  CP-SAT starts from a known
    feasible point instead of searching for feasibility from scratch, so
    ALL of the extra time budget is spent improving the objective.
    """
    t0         = time.monotonic()
    placements = snapshot["placements"]
    tm         = snapshot["time_model"]
    W          = tm["training_window_days"]
    S          = tm["slots_per_day"]
    meta       = snapshot.get("constraints_meta", {})
    allow_sat  = meta.get("allow_saturday", True)
    allow_sun  = meta.get("allow_sunday",   True)
    max_cls    = meta.get("max_classroom",  20)    # fixed default — was 999
    num_rooms  = int(meta.get("num_rooms",  2))
    start_date = tm.get("start_date")

    orig_emp_days = defaultdict(set)
    for p in placements:
        orig_emp_days[p["employee_id"]].add(p["day_index"])

    forbidden   = _weekend_mask(start_date, W, allow_sat, allow_sun)
    allowed     = [d for d in range(W) if d not in forbidden] or list(range(W))
    course_data = _build_course_index(placements)

    # ── Session splitting (enforces max_classroom) ────────────────────────
    session_plan: dict = {}
    for cid, cd in course_data.items():
        emps   = cd["employees"]
        n_sess = max(1, ceil(len(emps) / max_cls))
        sessions = [[] for _ in range(n_sess)]
        for i, eid in enumerate(emps):
            sessions[i % n_sess].append(eid)
        session_plan[cid] = sessions

    # ── Build warm-start hint map from previous solution ─────────────────
    # Maps (employee_id, course_id) → (day_index, start_slot)
    hint_map: dict = {}
    if warm_start_snapshot is not None:
        for p in warm_start_snapshot.get("placements", []):
            if not p.get("overflow"):
                hint_map[(p["employee_id"], p["course_id"])] = (
                    p["day_index"], p["start_slot"]
                )

    # ── Model variables ───────────────────────────────────────────────────
    model        = cp_model.CpModel()
    all_intervals = []
    all_demands   = []
    session_vars  = {}   # (cid, s_idx) → (d_var, s_var)
    session_ivs   = {}   # (cid, s_idx) → interval_var (global timeline)

    for cid, sessions in session_plan.items():
        dur = course_data[cid]["duration_slots"]
        if dur > S:
            continue
        for s_idx, emp_list in enumerate(sessions):
            if not emp_list:
                continue
            key = f"{cid}_{s_idx}"

            d_var  = model.NewIntVarFromDomain(
                         cp_model.Domain.FromValues(allowed), f"d_{key}")
            s_var  = model.NewIntVar(0, S - dur,    f"s_{key}")
            gs_var = model.NewIntVar(0, W * S,       f"gs_{key}")
            ge_var = model.NewIntVar(0, W * S + dur, f"ge_{key}")

            model.Add(gs_var == d_var * S + s_var)
            model.Add(ge_var == gs_var + dur)

            iv = model.NewIntervalVar(gs_var, dur, ge_var, f"iv_{key}")
            all_intervals.append(iv)
            all_demands.append(1)
            session_vars[(cid, s_idx)] = (d_var, s_var)
            session_ivs[(cid, s_idx)]  = iv

            # Warm-start hint: seed with known feasible day/slot so CP-SAT
            # starts improving immediately rather than searching for feasibility
            if hint_map:
                for eid in emp_list:
                    if (eid, cid) in hint_map:
                        hday, hslot = hint_map[(eid, cid)]
                        if hday in allowed and 0 <= hslot <= S - dur:
                            model.AddHint(d_var, hday)
                            model.AddHint(s_var, hslot)
                        break  # one representative employee is enough per session

    # ── Constraint 1: Room capacity ───────────────────────────────────────
    if all_intervals:
        model.AddCumulative(all_intervals, all_demands, num_rooms)

    # ── Constraint 2: Per-employee no-overlap ─────────────────────────────
    # Collect the intervals belonging to each employee across all sessions.
    # No two intervals for the same employee may overlap on the global timeline.
    emp_to_ivs: dict = defaultdict(list)
    for (cid, s_idx), iv in session_ivs.items():
        for eid in session_plan[cid][s_idx]:
            emp_to_ivs[eid].append(iv)

    for eid, ivs in emp_to_ivs.items():
        if len(ivs) >= 2:
            model.AddNoOverlap(ivs)

    # ── Objective: minimise total weighted day usage (→ compression) ──────
    obj_terms = []
    for (cid, s_idx), (d_var, _) in session_vars.items():
        n = len(session_plan[cid][s_idx])
        obj_terms.append(d_var * n)
    if obj_terms:
        model.Minimize(sum(obj_terms))

    # ── Solve ─────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers         = NUM_WORKERS
    solver.parameters.log_search_progress = False

    if callback is not None:
        cb = _StreamCallback(
            session_vars, session_plan, course_data, S,
            placements, orig_emp_days, snapshot, max_cls, t0, callback, num_rooms
        )
        status = solver.SolveWithSolutionCallback(model, cb)
    else:
        status = solver.Solve(model)

    # ── Extract result ────────────────────────────────────────────────────
    feasible  = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    if not feasible:
        # CP-SAT found nothing — fall back to greedy as a last resort
        result = _greedy_solve(snapshot)
        result["solve_metadata"] = {
            "status": "INFEASIBLE", "is_optimal": False, "is_feasible": False,
            "elapsed_seconds":    round(time.monotonic() - t0, 3),
            "time_limit_seconds": time_limit,
            "gap_percent":        None,
            "solutions_found":    0,
            "solver_label":       "greedy_fallback",
        }
        if callback is not None:
            callback(copy.deepcopy(result),
                     result["metrics"].get("score", 0),
                     time.monotonic() - t0, done=True)
        return result

    is_optimal    = (status == cp_model.OPTIMAL)
    label         = "cpsat_optimal" if is_optimal else "cpsat_feasible"
    elapsed_final = time.monotonic() - t0
    obj           = solver.ObjectiveValue()
    bound         = solver.BestObjectiveBound()
    gap           = round(abs(obj - bound) / max(abs(obj), 1) * 100, 1) if obj != 0 else 0.0
    n_solutions   = getattr(cb, "_solution_count", 1) if callback is not None else 1

    _apply_solution(
        placements, session_vars, session_plan, course_data,
        S, solver, orig_emp_days, snapshot,
        elapsed_final, label, max_cls, num_rooms
    )

    snapshot["solve_metadata"] = {
        "status":             "OPTIMAL" if is_optimal else "FEASIBLE",
        "is_optimal":         is_optimal,
        "is_feasible":        True,
        "elapsed_seconds":    round(elapsed_final, 3),
        "time_limit_seconds": time_limit,
        "gap_percent":        gap,
        "solutions_found":    n_solutions,
        "solver_label":       label,
    }

    if callback is not None:
        callback(copy.deepcopy(snapshot),
                 snapshot["metrics"].get("score", 0),
                 snapshot["metrics"].get("solve_seconds", 0), done=True)

    return snapshot
