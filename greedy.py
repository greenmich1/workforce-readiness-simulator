"""
greedy.py — Single-room heuristic solver.

Constraint: Only ONE course can run at any moment globally.
Strategy  : Sort courses by enrolment count (desc), pack sequentially
            into the training window without gaps.
"""
from collections import defaultdict


def greedy_optimize(snapshot: dict) -> dict:
    placements    = snapshot["placements"]
    tm            = snapshot["time_model"]
    window_days   = tm["training_window_days"]
    slots_per_day = tm["slots_per_day"]

    if not placements:
        snapshot["phase"] = "optimized"
        return snapshot

    # ── Collect planned day-spread for compression metric ─────────────────────
    orig_days: set = set()
    for p in placements:
        if not p.get("overflow"):
            orig_days.add(p["day_index"])

    # ── Group placements by course ────────────────────────────────────────────
    course_placements: dict = defaultdict(list)
    for p in placements:
        course_placements[p["course_id"]].append(p)

    # Duration per course (from first placement — all share same duration)
    course_dur = {
        cid: eps[0]["duration_slots"]
        for cid, eps in course_placements.items()
    }

    # Sort: most-enrolled courses first (maximises utilisation early in window)
    sorted_courses = sorted(
        course_placements.keys(),
        key=lambda c: len(course_placements[c]),
        reverse=True,
    )

    # ── Sequential packing ───────────────────────────────────────────────────
    # global_slot is an absolute index: day * slots_per_day + slot_within_day
    global_slot = 0
    opt_days: set = set()

    for course_id in sorted_courses:
        dur = course_dur[course_id]
        eps = course_placements[course_id]

        # Guard: duration 0 or longer than a full day → overflow
        if dur <= 0 or dur > slots_per_day:
            for p in eps:
                p["overflow"] = True
            continue

        placed = False
        while global_slot < window_days * slots_per_day:
            day  = global_slot // slots_per_day
            slot = global_slot % slots_per_day

            if slot + dur <= slots_per_day:
                # Fits within this day — commit
                for p in eps:
                    p["day_index"]  = day
                    p["start_slot"] = slot
                    p["overflow"]   = False
                opt_days.add(day)
                global_slot += dur
                placed = True
                break
            else:
                # Course would straddle midnight — skip to next day
                global_slot = (day + 1) * slots_per_day

        if not placed:
            for p in eps:
                p["overflow"] = True

    # ── Metrics ───────────────────────────────────────────────────────────────
    orig_span = len(orig_days)
    opt_span  = len(opt_days)
    compression = (
        round((orig_span - opt_span) / orig_span * 100)
        if orig_span > 0 else 0
    )
    compression = max(0, compression)

    snapshot["metrics"]["compression_percent"] = compression
    snapshot["metrics"]["score"]               = min(100, 40 + compression)
    snapshot["phase"]                          = "optimized"
    return snapshot
