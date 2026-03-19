"""
cpsat.py — OR-Tools CP-SAT Solver  (multi-room model, streaming-capable)
=========================================================================

Public API
----------
estimate_complexity(snapshot) → dict
    Returns complexity estimate before solving — used by frontend to set
    user expectations and decide whether to offer a deep-solve option.

optimize(snapshot, time_limit) → dict
    Blocking solve — returns final mutated snapshot.

optimize_stream(snapshot, callback, time_limit) → dict
    Streaming solve. callback(snap_copy, score, elapsed, done=False) is
    called each time CP-SAT finds an improving solution, then once more
    with done=True for the final result.

Solve metadata
--------------
Every solved snapshot gets a "solve_metadata" key:
    {
        "status":           "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN",
        "is_optimal":       bool,
        "is_feasible":      bool,
        "elapsed_seconds":  float,
        "time_limit_seconds": float,
        "gap_percent":      float | None,   # 0.0 when optimal
        "solutions_found":  int,
        "solver_label":     str,
    }

Frontend uses is_optimal + gap_percent to decide whether to offer the
"Continue solving with OR-Tools?" prompt.
"""

from __future__ import annotations

import copy
import math
import time
from collections import defaultdict
from datetime import date
from math import ceil

try:
    from ortools.sat.python import cp_model
    _ORTOOLS = True
except ImportError:
    _ORTOOLS = False

# Default time limit for the fast initial solve (Optimize Schedule button).
# The deep-solve SSE stream accepts an explicit time_limit override.
DEFAULT_TIME_LIMIT_SEC = 30.0
NUM_WORKERS            = 8


# ═══════════════════════════════════════════════════════════════════════════
# Complexity Estimator
# ═══════════════════════════════════════════════════════════════════════════

def estimate_complexity(snapshot: dict) -> dict:
    """
    Estimates CP-SAT solve time from problem structure before solving.

    Used by:
    - /simulate/generate response — frontend shows complexity badge immediately
    - /simulate/complexity/{id}  — frontend can re-fetch after parameter changes
    - Frontend logic to decide whether to show "Continue solving?" prompt

    Key complexity drivers:
    - num_sessions: number of CP-SAT interval variables (after class-size splitting)
    - window_days:  domain size per day variable
    - num_rooms:    tighter room caps = more constraint propagation
    - max_classroom: tighter caps = more sessions = more variables

    Returns:
        estimated_seconds   float   — rough wall-clock estimate
        complexity_score    int     — 0–100 logarithmic scale
        complexity_label    str     — "Simple" | "Moderate" | "Complex" | "Very Complex" | "Highly Complex"
        confidence          str     — "high" | "medium" | "low"
        suggest_deep_solve  bool    — True when estimated_seconds > DEFAULT_TIME_LIMIT_SEC
        drivers             dict    — raw inputs used for the estimate
    """
    placements   = snapshot["placements"]
    tm           = snapshot["time_model"]
    meta         = snapshot.get("constraints_meta", {})

    window_days   = tm["training_window_days"]
    slots_per_day = tm["slots_per_day"]
    max_cls       = meta.get("max_classroom", 20)
    num_rooms     = meta.get("num_rooms", 2)

    # Count unique courses and their enrolment sizes — this determines
    # how many sessions CP-SAT needs to schedule (the primary variable count)
    course_enrolment: dict = defaultdict(set)
    for p in placements:
        course_enrolment[p["course_id"]].add(p["employee_id"])

    num_courses   = len(course_enrolment)
    total_enrol   = sum(len(v) for v in course_enrolment.values())
    num_sessions  = sum(max(1, ceil(len(v) / max_cls)) for v in course_enrolment.values())
    num_employees = len(set(p["employee_id"] for p in placements))

    # Domain size × session count is the primary complexity driver.
    # Room constraint tightness amplifies it.
    room_pressure = 1.0 + max(0, (num_sessions / max(num_rooms, 1) - 1) * 0.1)

    # Empirical formula calibrated against OR-Tools benchmark runs:
    # T ≈ k * sessions^1.5 * log2(window) * room_pressure
    k   = 0.00015
    raw = k * (num_sessions ** 1.5) * math.log2(max(window_days, 2)) * room_pressure

    estimated_seconds = round(raw, 1)

    # Complexity score 0–100 on a log scale
    # 1s → ~10,  30s → ~45,  120s → ~60,  600s → ~80,  3600s → ~100
    if estimated_seconds <= 0:
        complexity_score = 0
    else:
        log_s = math.log10(max(estimated_seconds, 0.1))
        complexity_score = min(100, max(0, int(10 + (log_s / 3.56) * 90)))

    if estimated_seconds < 10:
        label = "Simple"
        confidence = "high"
    elif estimated_seconds < 30:
        label = "Moderate"
        confidence = "high"
    elif estimated_seconds < 120:
        label = "Complex"
        confidence = "medium"
    elif estimated_seconds < 600:
        label = "Very Complex"
        confidence = "medium"
    else:
        label = "Highly Complex"
        confidence = "low"

    return {
        "estimated_seconds":  estimated_seconds,
        "complexity_score":   complexity_score,
        "complexity_label":   label,
        "confidence":         confidence,
        "suggest_deep_solve": estimated_seconds > DEFAULT_TIME_LIMIT_SEC,
        "drivers": {
            "num_employees":  num_employees,
            "num_courses":    num_courses,
            "num_sessions":   num_sessions,
            "total_enrolments": total_enrol,
            "window_days":    window_days,
            "max_classroom":  max_cls,
            "num_rooms":      num_rooms,
            "room_pressure":  round(room_pressure, 3),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════

def optimize(snapshot, time_limit=DEFAULT_TIME_LIMIT_SEC):
    """Blocking solve — returns final mutated snapshot with solve_metadata."""
    if _ORTOOLS:
        return _cpsat_solve(snapshot, callback=None, time_limit=time_limit)
    return _greedy_solve(snapshot)


def optimize_stream(snapshot, callback, time_limit=DEFAULT_TIME_LIMIT_SEC):
    """
    Streaming solve.
    callback(snap_copy, score, elapsed_s, done=False) fires on each
    improving solution, then once with done=True for the final result.
    time_limit is forwarded — pass a large value for deep-solve mode.
    """
    if _ORTOOLS:
        return _cpsat_solve(snapshot, callback=callback, time_limit=time_limit)
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


def _write_metrics(placements, orig_emp_days, snapshot, elapsed, label, max_classroom,
                   time_limit, status_name, is_optimal, gap_percent, solutions_found):
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

    readiness = round((scheduled_placements / total_placements) * 100) if total_placements > 0 else 0

    course_data = _build_course_index(placements)
    oversized   = sum(1 for cd in course_data.values() if len(cd["employees"]) > max_classroom)

    m = snapshot.setdefault("metrics", {})
    m["compression_percent"]  = compression
    m["score"]                = readiness
    m["solver"]               = label
    m["solve_seconds"]        = round(elapsed, 3)
    m["overflow_count"]       = overflow_count
    m["total_placements"]     = total_placements
    m["scheduled_placements"] = scheduled_placements
    m["oversized_courses"]    = oversized
    snapshot["phase"]         = "optimized"

    # Solve metadata — consumed by frontend to drive the progressive solve UX
    snapshot["solve_metadata"] = {
        "status":             status_name,
        "is_optimal":         is_optimal,
        "is_feasible":        status_name in ("OPTIMAL", "FEASIBLE"),
        "elapsed_seconds":    round(elapsed, 3),
        "time_limit_seconds": time_limit,
        "gap_percent":        gap_percent,
        "solutions_found":    solutions_found,
        "solver_label":       label,
    }


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
                    orig_emp_days, snapshot, elapsed, label, max_cls, num_rooms,
                    time_limit, status_name, is_optimal, gap_percent, solutions_found):
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

    _write_metrics(
        placements, orig_emp_days, snapshot, elapsed, label, max_cls,
        time_limit, status_name, is_optimal, gap_percent, solutions_found,
    )


# ═══════════════════════════════════════════════════════════════════════════
# Greedy fallback — only used when OR-Tools is unavailable or CP-SAT
# finds no feasible solution within the time limit.
# ═══════════════════════════════════════════════════════════════════════════

def _greedy_solve(snapshot, time_limit=DEFAULT_TIME_LIMIT_SEC):
    t0         = time.monotonic()
    placements = snapshot["placements"]
    tm         = snapshot["time_model"]
    W          = tm["training_window_days"]
    S          = tm["slots_per_day"]
    meta       = snapshot.get("constraints_meta", {})
    max_cls    = meta.get("max_classroom", 20)

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

    _write_metrics(
        placements, orig_emp_days, snapshot,
        time.monotonic() - t0, "greedy_fallback", max_cls,
        time_limit, "FEASIBLE", False, None, 1,
    )
    return snapshot


# ═══════════════════════════════════════════════════════════════════════════
# CP-SAT Streaming Callback — fires on each improved solution
# ═══════════════════════════════════════════════════════════════════════════

class _StreamCallback(cp_model.CpSolverSolutionCallback):
    def __init__(self, session_vars, session_plan, course_data, S,
                 placements, orig_emp_days, snapshot, max_cls, t0,
                 user_cb, num_rooms, time_limit):
        super().__init__()
        self._sv            = session_vars
        self._sp            = session_plan
        self._cd            = course_data
        self._S             = S
        self._placements    = placements
        self._orig          = orig_emp_days
        self._snap          = snapshot
        self._max_cls       = max_cls
        self._t0            = t0
        self._user_cb       = user_cb
        self._best_obj      = float("inf")
        self._num_rooms     = num_rooms
        self._time_limit    = time_limit
        self._solution_count = 0

    def on_solution_callback(self):
        obj = self.ObjectiveValue()
        if obj >= self._best_obj:
            return
        self._best_obj = obj
        self._solution_count += 1
        elapsed = time.monotonic() - self._t0

        bound       = self.BestObjectiveBound()
        gap_percent = round(abs(obj - bound) / max(abs(obj), 1) * 100, 1) if obj != 0 else 0.0

        snap_copy        = copy.deepcopy(self._snap)
        placements_copy  = snap_copy["placements"]
        sv_copy          = {k: v for k, v in self._sv.items()}

        _apply_solution(
            placements_copy, sv_copy, self._sp, self._cd,
            self._S, self, self._orig, snap_copy,
            elapsed, "cpsat_intermediate", self._max_cls, self._num_rooms,
            self._time_limit, "FEASIBLE", False, gap_percent, self._solution_count,
        )
        score = snap_copy["metrics"].get("score", 0)
        try:
            self._user_cb(snap_copy, score, elapsed, done=False)
        except Exception:
            pass  # never crash the solver thread


# ═══════════════════════════════════════════════════════════════════════════
# CP-SAT Solver Core
# ═══════════════════════════════════════════════════════════════════════════

def _cpsat_solve(snapshot, callback, time_limit=DEFAULT_TIME_LIMIT_SEC):
    t0         = time.monotonic()
    placements = snapshot["placements"]
    tm         = snapshot["time_model"]
    W          = tm["training_window_days"]
    S          = tm["slots_per_day"]
    meta       = snapshot.get("constraints_meta", {})
    allow_sat  = meta.get("allow_saturday", True)
    allow_sun  = meta.get("allow_sunday",   True)
    max_cls    = meta.get("max_classroom",  20)   # ← was 999; now correctly defaults to 20
    num_rooms  = int(meta.get("num_rooms", 2))
    start_date = tm.get("start_date")

    orig_emp_days = defaultdict(set)
    for p in placements:
        orig_emp_days[p["employee_id"]].add(p["day_index"])

    forbidden   = _weekend_mask(start_date, W, allow_sat, allow_sun)
    allowed     = [d for d in range(W) if d not in forbidden] or list(range(W))
    course_data = _build_course_index(placements)

    # ── Session splitting (enforces max_classroom) ────────────────────────────
    # Each course is split into ceil(enrolled / max_cls) sessions.
    # Each session becomes one CP-SAT interval variable — this IS the
    # class size constraint. Sessions cannot overlap in the room schedule.
    session_plan = {}
    for cid, cd in course_data.items():
        emps     = cd["employees"]
        n_sess   = max(1, ceil(len(emps) / max_cls))
        sessions = [[] for _ in range(n_sess)]
        for i, eid in enumerate(emps):
            sessions[i % n_sess].append(eid)
        session_plan[cid] = sessions

    model         = cp_model.CpModel()
    all_intervals = []
    all_demands   = []
    session_vars  = {}

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

    # Room capacity: at most num_rooms sessions running concurrently
    if all_intervals:
        model.AddCumulative(all_intervals, all_demands, num_rooms)

    # Objective: minimise weighted sum of day indices (proxy for minimising
    # total employee-training-days — earlier days = fewer days used overall)
    obj_terms = []
    for (cid, s_idx), (d_var, _) in session_vars.items():
        n = len(session_plan[cid][s_idx])
        obj_terms.append(d_var * n)
    if obj_terms:
        model.Minimize(sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers         = NUM_WORKERS
    solver.parameters.log_search_progress = False

    if callback is not None:
        cb = _StreamCallback(
            session_vars, session_plan, course_data, S,
            placements, orig_emp_days, snapshot, max_cls, t0,
            callback, num_rooms, time_limit,
        )
        status = solver.SolveWithSolutionCallback(model, cb)
        solutions_found = cb._solution_count
    else:
        status = solver.Solve(model)
        solutions_found = 1 if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0

    elapsed   = time.monotonic() - t0
    feasible  = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    is_optimal = status == cp_model.OPTIMAL
    status_name = solver.StatusName(status)  # "OPTIMAL", "FEASIBLE", etc.

    # ── Fallback: if CP-SAT found nothing, use greedy ─────────────────────────
    if not feasible:
        result = _greedy_solve(snapshot, time_limit)
        if callback is not None:
            callback(copy.deepcopy(result),
                     result["metrics"].get("score", 0),
                     elapsed, done=True)
        return result

    # ── Gap percent (how far from proven optimal) ─────────────────────────────
    obj   = solver.ObjectiveValue()
    bound = solver.BestObjectiveBound()
    gap_percent = round(abs(obj - bound) / max(abs(obj), 1) * 100, 1) if obj != 0 else 0.0

    label = "cpsat_optimal" if is_optimal else "cpsat_feasible"

    _apply_solution(
        placements, session_vars, session_plan, course_data,
        S, solver, orig_emp_days, snapshot,
        elapsed, label, max_cls, num_rooms,
        time_limit, status_name, is_optimal, gap_percent, solutions_found,
    )

    if callback is not None:
        callback(
            copy.deepcopy(snapshot),
            snapshot["metrics"].get("score", 0),
            snapshot["metrics"].get("solve_seconds", 0),
            done=True,
        )

    return snapshot
