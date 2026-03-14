# solvers/__init__.py
# Solver modules for the Workforce Readiness Simulator.
#
# Current:
#   greedy.py   — heuristic packing solver
#
# Future:
#   cpsat.py    — OR-Tools CP-SAT constraint programming solver
#
# All solvers must implement the interface:
#   optimize(snapshot: dict) -> dict
