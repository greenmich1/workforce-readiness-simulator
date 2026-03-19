"""
main.py — FastAPI application for Enterprise Training Scheduler.

Endpoints
---------
GET  /health
POST /simulate/generate
POST /simulate/solve/{sim_id}        — blocking fast solve (30s default)
GET  /simulate/solve-stream/{sim_id} — SSE deep solve, warm-started from fast result
GET  /simulate/{sim_id}

Deep solve architecture
-----------------------
- Fast solve (POST):  runs on snapshot_planned, 30s, finds feasible solution
- Deep solve (GET SSE): runs on snapshot_planned again but warm-started from
  the fast-solve result via AddHint — so CP-SAT skips re-finding feasibility
  and spends ALL of the extended budget improving the objective.
  This is why "Continue →Optimal" makes genuine progress.
"""
from __future__ import annotations

import copy, json, threading, queue
from datetime import datetime, timezone
from typing import Dict
from uuid import uuid4

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

import cpsat
from generator import build_snapshot_from_profile
from models import GeneratorProfile

app = FastAPI(title="Enterprise Training Scheduler", version="0.3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulations: Dict[str, dict] = {}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "solver": "cpsat" if cpsat._ORTOOLS else "greedy_fallback",
        "default_time_limit_seconds": cpsat.TIME_LIMIT_SEC,
    }


@app.post("/simulate/generate")
def generate_simulation(profile: GeneratorProfile):
    simulation_id = str(uuid4())
    snapshot = build_snapshot_from_profile(profile)
    snapshot["constraints_meta"] = {
        "allow_saturday": profile.allow_saturday,
        "allow_sunday":   profile.allow_sunday,
        "max_classroom":  profile.max_classroom,
        "num_rooms":      profile.num_rooms,
    }
    obj = {
        "simulation_id":    simulation_id,
        "status":           "generated",
        "created_at":       datetime.now(timezone.utc).isoformat(),
        "snapshot":         snapshot,
        # Immutable original — deep solve always restarts from here
        # so it has the full search space, not a pre-packed result
        "snapshot_planned": copy.deepcopy(snapshot),
    }
    simulations[simulation_id] = obj
    return obj


@app.post("/simulate/solve/{simulation_id}", response_model=None)
def solve_simulation(
    simulation_id: str,
    time_limit_seconds: float = Query(default=30.0, ge=5.0, le=3600.0),
    num_rooms: int = Query(default=0),
):
    """Fast blocking solve — typically 30s, returns best feasible result."""
    if simulation_id not in simulations:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})

    sim      = simulations[simulation_id]
    snapshot = sim["snapshot"]

    if num_rooms in (1, 2):
        snapshot.setdefault("constraints_meta", {})["num_rooms"] = num_rooms

    optimized = cpsat.optimize(snapshot, time_limit=time_limit_seconds)
    sim["snapshot"] = optimized
    sim["status"]   = "solved"
    simulations[simulation_id] = sim
    return sim


@app.get("/simulate/solve-stream/{simulation_id}")
def solve_stream(
    simulation_id: str,
    time_limit_seconds: float = Query(default=300.0, ge=30.0, le=3600.0),
    num_rooms: int = Query(default=0),
):
    """
    SSE deep solve — streams each improving CP-SAT solution.

    Key behaviour:
    - Solves from snapshot_planned (full search space, not pre-packed)
    - Warm-starts from sim["snapshot"] (fast solve result) via AddHint
      so CP-SAT immediately has a feasible starting point and spends
      all of time_limit_seconds improving, not re-finding feasibility
    - Stream timeout = time_limit_seconds + 30s grace
    """
    if simulation_id not in simulations:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})

    sim = simulations[simulation_id]

    # Base problem: original planned snapshot (full search space)
    planned = sim.get("snapshot_planned") or sim["snapshot"]
    snap_copy = copy.deepcopy(planned)

    # Warm start: current best solution from fast solve
    warm_start = copy.deepcopy(sim.get("snapshot"))

    if num_rooms in (1, 2):
        snap_copy.setdefault("constraints_meta", {})["num_rooms"] = num_rooms

    q: queue.Queue = queue.Queue()

    def callback(snap, score, elapsed, done=False):
        q.put({
            "type":     "done" if done else "progress",
            "score":    score,
            "elapsed":  round(elapsed, 3),
            "snapshot": snap,
        })

    def run_solver():
        result = cpsat.optimize_stream(
            snap_copy,
            callback,
            time_limit=time_limit_seconds,
            warm_start_snapshot=warm_start,   # ← the key fix
        )
        sim["snapshot"] = result
        sim["status"]   = "solved"
        simulations[simulation_id] = sim

    threading.Thread(target=run_solver, daemon=True).start()

    # Get fast-solve objective for comparison (lower = better packing)
    fast_solve_meta = sim.get("snapshot", {}).get("solve_metadata", {})
    fast_objective  = fast_solve_meta.get("objective_value")

    stream_timeout = time_limit_seconds + 30.0

    def event_stream():
        # Emit immediately so frontend clock starts ticking right away
        yield f"data: {json.dumps({'type': 'started', 'fast_objective': fast_objective})}\n\n"

        elapsed_ticks = 0
        while True:
            try:
                item = q.get(timeout=5.0)
                # Attach objective improvement to done event
                if item["type"] == "done":
                    deep_meta = (item.get("snapshot") or {}).get("solve_metadata", {})
                    deep_obj  = deep_meta.get("objective_value")
                    if fast_objective and deep_obj and fast_objective > 0:
                        improvement = round((fast_objective - deep_obj) / fast_objective * 100, 1)
                    else:
                        improvement = 0.0
                    item["objective_improvement_percent"] = max(0.0, improvement)
                yield f"data: {json.dumps(item, default=str)}\n\n"
                if item["type"] == "done":
                    break
            except queue.Empty:
                elapsed_ticks += 5
                if elapsed_ticks >= stream_timeout:
                    yield 'data: {"type":"timeout"}\n\n'
                    break
                hb = json.dumps({"type": "heartbeat", "elapsed": elapsed_ticks})
                yield f"data: {hb}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/simulate/complexity/{simulation_id}")
def get_complexity(simulation_id: str):
    """Returns complexity estimate — used by frontend to size the deep-solve budget."""
    sim = simulations.get(simulation_id)
    if sim is None:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})
    snap = sim.get("snapshot_planned") or sim["snapshot"]
    return _estimate_complexity(snap)


def _estimate_complexity(snapshot: dict) -> dict:
    import math
    from math import ceil
    placements = snapshot["placements"]
    tm         = snapshot["time_model"]
    meta       = snapshot.get("constraints_meta", {})
    window_days   = tm["training_window_days"]
    max_cls       = meta.get("max_classroom", 20)
    num_rooms     = meta.get("num_rooms", 2)
    from collections import defaultdict
    course_enrolment: dict = defaultdict(set)
    for p in placements:
        course_enrolment[p["course_id"]].add(p["employee_id"])
    num_courses   = len(course_enrolment)
    total_enrol   = sum(len(v) for v in course_enrolment.values())
    num_sessions  = sum(max(1, ceil(len(v) / max_cls)) for v in course_enrolment.values())
    num_employees = len(set(p["employee_id"] for p in placements))

    # Room pressure: tighter room cap = harder to pack
    room_pressure = 1.0 + max(0, (num_sessions / max(num_rooms, 1) - 1) * 0.1)

    # No-overlap factor: each employee with N courses adds N*(N-1)/2 no-overlap pairs.
    # This is the dominant constraint cost added by AddNoOverlap.
    avg_courses_per_emp = total_enrol / max(num_employees, 1)
    nooverlap_factor = max(1.0, avg_courses_per_emp ** 1.8)

    # Calibrated against observed solve times with AddNoOverlap enforced:
    # k=0.006 gives ~30s for 91 sessions / 500 emp / 31-day window — matches reality
    k   = 0.006
    raw = k * (num_sessions ** 1.3) * math.log2(max(window_days, 2)) * room_pressure * nooverlap_factor
    estimated_seconds = round(raw, 1)

    if estimated_seconds <= 0:
        score = 0
    else:
        log_s = math.log10(max(estimated_seconds, 0.1))
        score = min(100, max(0, int(10 + (log_s / 3.56) * 90)))
    if estimated_seconds < 10:   label, confidence = "Simple",        "high"
    elif estimated_seconds < 30: label, confidence = "Moderate",       "high"
    elif estimated_seconds < 120:label, confidence = "Complex",        "medium"
    elif estimated_seconds < 600:label, confidence = "Very Complex",   "medium"
    else:                        label, confidence = "Highly Complex", "low"
    return {
        "estimated_seconds":   estimated_seconds,
        "complexity_score":    score,
        "complexity_label":    label,
        "confidence":          confidence,
        "suggest_deep_solve":  estimated_seconds > 30,
        "drivers": {
            "num_employees":     num_employees,
            "num_courses":       num_courses,
            "num_sessions":      num_sessions,
            "total_enrolments":  total_enrol,
            "window_days":       window_days,
            "max_classroom":     max_cls,
            "num_rooms":         num_rooms,
            "room_pressure":     round(room_pressure, 3),
            "nooverlap_factor":  round(nooverlap_factor, 3),
        },
    }


@app.get("/simulate/{simulation_id}", response_model=None)
def get_simulation(simulation_id: str):
    if simulation_id not in simulations:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})
    return simulations[simulation_id]
