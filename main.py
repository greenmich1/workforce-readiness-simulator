"""
main.py — FastAPI application for Enterprise Training Scheduler.

Endpoints
---------
GET  /health
POST /simulate/generate
GET  /simulate/complexity/{sim_id}      — complexity estimate (no solve)
POST /simulate/solve/{sim_id}           — blocking CP-SAT solve
GET  /simulate/solve-stream/{sim_id}    — SSE deep-solve (user opt-in)
GET  /simulate/{sim_id}

Progressive solve flow
----------------------
1. POST /simulate/generate
   → Response includes "complexity" block with estimated_seconds,
     complexity_label, suggest_deep_solve.

2. POST /simulate/solve/{sim_id}?time_limit_seconds=30
   → Fast initial solve (Optimize Schedule button).
   → Response includes snapshot.solve_metadata:
       { status, is_optimal, gap_percent, elapsed_seconds, ... }
   → If is_optimal=false AND suggest_deep_solve=true:
       Frontend transforms button → "Continue solving with OR-Tools →"
       and shows estimated_seconds as projected time.

3. GET /simulate/solve-stream/{sim_id}?time_limit_seconds=300
   → User opted in to deep solve.
   → Streams SSE events:
       { type: "progress", score, gap_percent, elapsed_seconds, snapshot }
       { type: "done",     score, gap_percent, elapsed_seconds, snapshot, is_optimal }
   → Frontend drives live clock and score counter from these events.
   → On "done", if is_optimal=true: button returns to solved state.
     If still feasible: offer another "Continue?" with longer limit.
"""
from __future__ import annotations

import copy
import json
import queue
import threading
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


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "solver": "cpsat" if cpsat._ORTOOLS else "greedy_fallback",
        "default_time_limit_seconds": cpsat.DEFAULT_TIME_LIMIT_SEC,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Generate
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/simulate/generate")
def generate_simulation(profile: GeneratorProfile):
    simulation_id = str(uuid4())
    snapshot = build_snapshot_from_profile(profile)

    # constraints_meta is the authoritative source for solver constraints.
    # It is set once here from the profile and never overwritten by solve
    # unless the frontend explicitly passes an override (e.g. num_rooms).
    snapshot["constraints_meta"] = {
        "allow_saturday": profile.allow_saturday,
        "allow_sunday":   profile.allow_sunday,
        "max_classroom":  profile.max_classroom,
        "num_rooms":      profile.num_rooms,
    }

    complexity = cpsat.estimate_complexity(snapshot)

    obj = {
        "simulation_id": simulation_id,
        "status":        "generated",
        "created_at":    datetime.now(timezone.utc).isoformat(),
        "snapshot":      snapshot,
        "complexity":    complexity,
    }
    simulations[simulation_id] = obj
    return obj


# ─────────────────────────────────────────────────────────────────────────────
# Complexity estimate (standalone — useful after parameter changes)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/simulate/complexity/{simulation_id}")
def get_complexity(simulation_id: str):
    """
    Returns a fresh complexity estimate for a stored simulation.

    Frontend uses this when:
    - Displaying the complexity badge on the simulator page
    - Deciding whether to show the "Continue solving?" prompt
    - Showing projected solve time before the user opts in to deep solve
    """
    sim = simulations.get(simulation_id)
    if sim is None:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})
    return cpsat.estimate_complexity(sim["snapshot"])


# ─────────────────────────────────────────────────────────────────────────────
# Blocking solve (fast initial — Optimize Schedule button)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/simulate/solve/{simulation_id}", response_model=None)
def solve_simulation(
    simulation_id: str,
    time_limit_seconds: float = Query(
        default=30.0,
        ge=5.0,
        le=3600.0,
        description="CP-SAT wall-clock time limit. Default 30s gives a fast feasible result. "
                    "Pass a larger value for the deep-solve path.",
    ),
    num_rooms: int = Query(
        default=0,
        description="Override num_rooms constraint at solve time (1 or 2). "
                    "0 means use whatever is in constraints_meta.",
    ),
):
    """
    Runs OR-Tools CP-SAT up to time_limit_seconds.

    Response always includes snapshot.solve_metadata:
        status           "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN"
        is_optimal       bool  — True only when gap = 0 and proof complete
        gap_percent      float — how far the solution is from proven optimum
        elapsed_seconds  float
        solutions_found  int

    Frontend decision logic:
        if is_optimal → show "Optimal ✓"
        elif gap_percent < 5 → show "Near-optimal"
        else → show "Continue solving with OR-Tools →" + estimated time
    """
    sim = simulations.get(simulation_id)
    if sim is None:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})

    snapshot = sim["snapshot"]

    # Allow frontend to override num_rooms at solve time (e.g. room toggle)
    if num_rooms in (1, 2):
        snapshot.setdefault("constraints_meta", {})["num_rooms"] = num_rooms

    optimized = cpsat.optimize(snapshot, time_limit=time_limit_seconds)

    sim["snapshot"] = optimized
    sim["status"]   = "solved"
    sim["complexity"] = cpsat.estimate_complexity(optimized)
    simulations[simulation_id] = sim
    return sim


# ─────────────────────────────────────────────────────────────────────────────
# Streaming deep-solve (user opt-in after fast solve)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/simulate/solve-stream/{simulation_id}")
def solve_stream(
    simulation_id: str,
    time_limit_seconds: float = Query(
        default=300.0,
        ge=30.0,
        le=3600.0,
        description="How long to keep solving. Frontend passes complexity.estimated_seconds "
                    "rounded up to the nearest sensible value.",
    ),
    num_rooms: int = Query(default=0),
):
    """
    Server-Sent Events — streams each improved CP-SAT solution in real time.

    This is the deep-solve path the user opts into after the fast 30s solve
    returns a feasible-but-not-optimal result.

    Events
    ------
    { "type": "progress", "score": N, "gap_percent": F, "elapsed_seconds": F,
      "solutions_found": N, "snapshot": {...} }

    { "type": "done", "score": N, "gap_percent": F, "elapsed_seconds": F,
      "is_optimal": bool, "solutions_found": N, "snapshot": {...} }

    { "type": "timeout" }   — emitted if the queue stalls unexpectedly

    Frontend behaviour
    ------------------
    - Open SSE connection when user clicks "Continue solving →"
    - On each "progress" event: update score card, gap badge, elapsed clock
    - On "done": stop clock, show final status badge (Optimal / Feasible)
    - If done.is_optimal=false: optionally offer another "Continue?" round
    """
    sim = simulations.get(simulation_id)
    if sim is None:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})

    # Deep copy so the background solver doesn't mutate the stored snapshot
    # until it is done — prevents partial states being served by GET /simulate/{id}
    snap_copy = copy.deepcopy(sim["snapshot"])

    if num_rooms in (1, 2):
        snap_copy.setdefault("constraints_meta", {})["num_rooms"] = num_rooms

    q: queue.Queue = queue.Queue()

    def callback(snap, score, elapsed, done=False):
        meta = snap.get("solve_metadata", {})
        q.put({
            "type":             "done" if done else "progress",
            "score":            score,
            "gap_percent":      meta.get("gap_percent"),
            "elapsed_seconds":  round(elapsed, 2),
            "is_optimal":       meta.get("is_optimal", False),
            "solutions_found":  meta.get("solutions_found", 0),
            "snapshot":         snap,
        })

    def run_solver():
        result = cpsat.optimize_stream(snap_copy, callback, time_limit=time_limit_seconds)
        # Commit final result to the store once the solver thread finishes
        sim["snapshot"] = result
        sim["status"]   = "solved"
        sim["complexity"] = cpsat.estimate_complexity(result)
        simulations[simulation_id] = sim

    threading.Thread(target=run_solver, daemon=True).start()

    def event_stream():
        # Timeout is time_limit + 10s grace period
        timeout = time_limit_seconds + 10.0
        while True:
            try:
                item = q.get(timeout=timeout)
                yield f"data: {json.dumps(item, default=str)}\n\n"
                if item["type"] == "done":
                    break
            except queue.Empty:
                yield 'data: {"type":"timeout"}\n\n'
                break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Get simulation
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/simulate/{simulation_id}", response_model=None)
def get_simulation(simulation_id: str):
    sim = simulations.get(simulation_id)
    if sim is None:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})
    return sim
