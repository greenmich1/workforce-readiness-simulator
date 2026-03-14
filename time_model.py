"""
time_model.py
-------------
Derives the time model for a simulation from user-supplied profile values.

All constants that were previously hardcoded in main.py are now computed
here from the profile, making the time model fully configurable per run.

Valid slot_minutes values are restricted to divisors of 60 so that slots
align cleanly to hour boundaries:
    5, 6, 10, 12, 15, 20, 30, 60
"""

from typing import Final

# --------------------------------------------------
# System-level defaults (used when profile omits values)
# --------------------------------------------------

DEFAULT_DAY_START_HOUR: Final[int] = 7
DEFAULT_DAY_END_HOUR: Final[int] = 20
DEFAULT_SLOT_MINUTES: Final[int] = 15

# Slot minutes must divide evenly into 60 minutes
VALID_SLOT_MINUTES: Final[tuple] = (5, 6, 10, 12, 15, 20, 30, 60)


def build_time_model(
    day_start_hour: int,
    day_end_hour: int,
    slot_minutes: int,
    training_window_days: int,
) -> dict:
    """
    Derive and return a fully resolved time model dict from user-supplied values.

    This is the authoritative time model that gets embedded in every Snapshot.
    Frontend must derive all grid sizing from this object — never hardcode.
    """
    slots_per_hour = 60 // slot_minutes
    hours_per_day = day_end_hour - day_start_hour
    slots_per_day = hours_per_day * slots_per_hour

    return {
        "day_start_hour": day_start_hour,
        "day_end_hour": day_end_hour,
        "slot_minutes": slot_minutes,
        "slots_per_hour": slots_per_hour,
        "hours_per_day": hours_per_day,
        "slots_per_day": slots_per_day,
        "training_window_days": training_window_days,
    }
