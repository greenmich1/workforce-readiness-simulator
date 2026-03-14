"""
store.py
--------
In-memory simulation store for the Workforce Readiness Simulator.

Provides a stable interface (create / get / update) so that the migration
target (Redis, Postgres, GCS) requires no changes to endpoint code — only
this module needs to be replaced.

Simulation object schema:
    {
        "simulation_id": str,
        "status": str,
        "created_at": str (ISO-8601),
        "snapshot_planned": dict,   # immutable after generate — never overwritten
        "snapshot": dict,           # current state (planned or optimized)
    }

Rules:
  - snapshot_planned is written once at create() and never touched again.
  - snapshot is the mutable current state; solve() overwrites it.
  - A new generate() call creates a new simulation_id; it does NOT overwrite
    a previous simulation's planned snapshot. "One run = one simulation_id."
"""

from typing import Optional

_store: dict = {}


def create(simulation_id: str, obj: dict) -> None:
    """
    Store a new simulation. Raises ValueError if the id already exists.
    """
    if simulation_id in _store:
        raise ValueError(f"Simulation {simulation_id!r} already exists.")
    _store[simulation_id] = obj


def get(simulation_id: str) -> Optional[dict]:
    """
    Return the simulation object, or None if not found.
    """
    return _store.get(simulation_id)


def update(simulation_id: str, obj: dict) -> None:
    """
    Overwrite an existing simulation object.
    Raises KeyError if simulation_id is not found.
    """
    if simulation_id not in _store:
        raise KeyError(f"Simulation {simulation_id!r} not found.")
    _store[simulation_id] = obj


def exists(simulation_id: str) -> bool:
    """
    Return True if simulation_id is present in the store.
    """
    return simulation_id in _store
