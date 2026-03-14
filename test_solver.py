"""
test_solver.py — Quick smoke tests for the CP-SAT solver.

Run with:  python test_solver.py
"""
import sys
import time

sys.path.insert(0, ".")

from models import GeneratorProfile
from generator import build_snapshot_from_profile
import cpsat

# ── helpers ───────────────────────────────────────────────────────────────────

def make_snapshot(employees=50, roles=8, courses=15, window=21,
                  allow_sat=False, allow_sun=False, max_cls=20):
    profile = GeneratorProfile(
        employees=employees, roles=roles, courses=courses,
        sites=1, shift_patterns=1, relationship_density=0.6,
        training_window_days=window,
        allow_saturday=allow_sat, allow_sunday=allow_sun,
        max_classroom=max_cls,
    )
    snap = build_snapshot_from_profile(profile)
    snap["constraints_meta"] = {
        "allow_saturday": allow_sat,
        "allow_sunday":   allow_sun,
        "max_classroom":  max_cls,
    }
    return snap


def assert_no_employee_overlap(placements, slots_per_day):
    from collections import defaultdict
    # Group non-overflow placements by employee
    by_emp = defaultdict(list)
    for p in placements:
        if not p.get("overflow"):
            by_emp[p["employee_id"]].append(p)
    violations = 0
    for eid, eps in by_emp.items():
        for i in range(len(eps)):
            for j in range(i + 1, len(eps)):
                a, b = eps[i], eps[j]
                if a["day_index"] != b["day_index"]:
                    continue
                # same day — check slot overlap
                a_end = a["start_slot"] + a["duration_slots"]
                b_end = b["start_slot"] + b["duration_slots"]
                if a["start_slot"] < b_end and b["start_slot"] < a_end:
                    violations += 1
    return violations


# ── tests ─────────────────────────────────────────────────────────────────────

def test_solver_available():
    assert cpsat._ORTOOLS, "OR-Tools not installed — run: pip install ortools"
    print("  ✓ OR-Tools available")


def test_basic_solve():
    snap = make_snapshot(employees=50, roles=8, courses=15, window=21)
    t0   = time.monotonic()
    out  = cpsat.optimize(snap)
    dt   = time.monotonic() - t0
    assert out["phase"] == "optimized",     "phase should be optimized"
    assert out["metrics"]["score"] >= 40,   "score should be ≥ 40"
    assert out["metrics"]["compression_percent"] >= 0
    print(f"  ✓ basic solve   score={out['metrics']['score']}  "
          f"compression={out['metrics']['compression_percent']}%  "
          f"solver={out['metrics']['solver']}  {dt:.2f}s")


def test_no_overlap():
    snap = make_snapshot(employees=80, roles=10, courses=20, window=28)
    out  = cpsat.optimize(snap)
    S    = out["time_model"]["slots_per_day"]
    v    = assert_no_employee_overlap(out["placements"], S)
    assert v == 0, f"Found {v} employee overlap violations!"
    print(f"  ✓ no employee overlaps  ({len(out['placements'])} placements)")


def test_weekend_exclusion():
    # start on a Monday (2026-03-16) → Sat=day5, Sun=day6
    snap = make_snapshot(employees=40, roles=6, courses=12, window=14,
                         allow_sat=False, allow_sun=False)
    snap["time_model"]["start_date"] = "2026-03-16"
    snap["constraints_meta"]["allow_saturday"] = False
    snap["constraints_meta"]["allow_sunday"]   = False
    out  = cpsat.optimize(snap)
    bad  = [p for p in out["placements"]
            if not p.get("overflow") and p["day_index"] in (5, 6, 12, 13)]
    assert len(bad) == 0, f"{len(bad)} placements fell on excluded weekends"
    print(f"  ✓ weekend exclusion  (0 placements on Sat/Sun)")


def test_large_instance():
    snap = make_snapshot(employees=200, roles=20, courses=40, window=60)
    t0   = time.monotonic()
    out  = cpsat.optimize(snap)
    dt   = time.monotonic() - t0
    S    = out["time_model"]["slots_per_day"]
    v    = assert_no_employee_overlap(out["placements"], S)
    assert v == 0,               "overlap violations on large instance"
    assert dt <= 35,             f"solve took {dt:.1f}s > 35s limit"
    print(f"  ✓ large instance  {len(out['placements'])} placements  "
          f"solver={out['metrics']['solver']}  {dt:.1f}s  "
          f"score={out['metrics']['score']}")


def test_determinism():
    snap1 = make_snapshot(employees=50, roles=8, courses=15, window=21)
    snap2 = make_snapshot(employees=50, roles=8, courses=15, window=21)
    out1  = cpsat.optimize(snap1)
    out2  = cpsat.optimize(snap2)
    days1 = sorted((p["employee_id"], p["course_id"], p["day_index"], p["start_slot"])
                   for p in out1["placements"])
    days2 = sorted((p["employee_id"], p["course_id"], p["day_index"], p["start_slot"])
                   for p in out2["placements"])
    assert days1 == days2, "Solver is non-deterministic across identical inputs"
    print("  ✓ deterministic output")


# ── runner ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    tests = [
        test_solver_available,
        test_basic_solve,
        test_no_overlap,
        test_weekend_exclusion,
        test_large_instance,
        test_determinism,
    ]
    failed = 0
    print("\nEnterprise Training Scheduler — Solver Tests\n" + "─" * 50)
    for t in tests:
        name = t.__name__.replace("test_", "").replace("_", " ")
        try:
            t()
        except AssertionError as e:
            print(f"  ✗ {name}: {e}")
            failed += 1
        except Exception as e:
            print(f"  ✗ {name}: EXCEPTION — {e}")
            failed += 1
    print("─" * 50)
    if failed:
        print(f"  {failed} test(s) FAILED")
        sys.exit(1)
    else:
        print(f"  All {len(tests)} tests passed ✓")
