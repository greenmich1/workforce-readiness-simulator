"""
main.py — FastAPI application for Enterprise Training Scheduler.

Endpoints
---------
GET  /health
POST /simulate/generate
POST /simulate/solve/{sim_id}        — blocking (kept for compatibility)
GET  /simulate/solve-stream/{sim_id} — SSE streaming (real-time updates)
GET  /simulate/{sim_id}
"""
from __future__ import annotations

import os, copy, json, threading, queue
from datetime import datetime, timezone
from typing import Dict
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

import cpsat
from generator import build_snapshot_from_profile
from models import GeneratorProfile

import os

app = FastAPI(title="Enterprise Training Scheduler", version="0.2")

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
    return {"status": "ok", "solver": "cpsat" if cpsat._ORTOOLS else "greedy_fallback"}


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
        "simulation_id": simulation_id,
        "status":        "generated",
        "created_at":    datetime.now(timezone.utc).isoformat(),
        "snapshot":      snapshot,
    }
    simulations[simulation_id] = obj
    return obj


@app.post("/simulate/solve/{simulation_id}", response_model=None)
def solve_simulation(simulation_id: str, time_limit_seconds: float = 30.0, num_rooms: int = 0):
    if simulation_id not in simulations:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})
    sim      = simulations[simulation_id]
    snapshot = sim["snapshot"]

    # Allow the frontend to override the num_rooms constraint at solve time.
    # This means changing the room toggle and clicking Optimize always uses
    # the current UI setting, even without re-generating.
    if num_rooms in (1, 2):
        snapshot.setdefault("constraints_meta", {})["num_rooms"] = num_rooms

    optimized = cpsat.optimize(snapshot, time_limit=time_limit_seconds)
    sim["snapshot"] = optimized
    sim["status"]   = "solved"
    simulations[simulation_id] = sim
    return sim


@app.get("/simulate/solve-stream/{simulation_id}")
def solve_stream(simulation_id: str):
    """
    Server-Sent Events endpoint — streams each improved CP-SAT solution.
    Each event: data: {"type":"progress"|"done", "score":N, "elapsed":F, "snapshot":{...}}
    """
    if simulation_id not in simulations:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})

    sim       = simulations[simulation_id]
    snap_copy = copy.deepcopy(sim["snapshot"])
    q: queue.Queue = queue.Queue()

    def callback(snap, score, elapsed, done=False):
        q.put({"type": "done" if done else "progress",
               "score": score, "elapsed": round(elapsed, 3), "snapshot": snap})

    def run_solver():
        result = cpsat.optimize_stream(snap_copy, callback)
        sim["snapshot"] = result
        sim["status"]   = "solved"
        simulations[simulation_id] = sim

    threading.Thread(target=run_solver, daemon=True).start()

    def event_stream():
        while True:
            try:
                item = q.get(timeout=35)
                yield f"data: {json.dumps(item, default=str)}\n\n"
                if item["type"] == "done":
                    break
            except queue.Empty:
                yield 'data: {"type":"timeout"}\n\n'
                break

    return StreamingResponse(event_stream(), media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})


@app.get("/simulate/{simulation_id}", response_model=None)
def get_simulation(simulation_id: str):
    if simulation_id not in simulations:
        return JSONResponse(status_code=404, content={"detail": "Simulation not found"})
    return simulations[simulation_id]
