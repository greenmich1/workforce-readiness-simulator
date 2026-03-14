"""
models.py — Pydantic request models for Enterprise Training Scheduler.
"""
from __future__ import annotations

from datetime import date
from typing import Optional
import json
import hashlib

from pydantic import BaseModel, Field, model_validator


class GeneratorProfile(BaseModel):
    # Workforce
    employees:            int   = Field(..., ge=20,  le=500)
    roles:                int   = Field(..., ge=5,   le=50)
    courses:              int   = Field(..., ge=10,  le=60)
    sites:                int   = Field(default=1,   ge=1, le=4)
    shift_patterns:       int   = Field(default=1,   ge=1, le=4)
    shift_pattern_ids:    list[str] = Field(default_factory=list)
    shift_split:          dict[str, float] = Field(default_factory=dict)
    relationship_density: float = Field(..., ge=0.1, le=1.0)

    # Date / window
    start_date:           Optional[str] = Field(None, description="ISO date e.g. 2026-03-13")
    end_date:             Optional[str] = Field(None, description="ISO date e.g. 2026-06-13")
    training_window_days: Optional[int] = Field(None, ge=14, le=90)

    # Day shape
    day_start_hour: int   = Field(default=7,  ge=5,  le=12)
    day_end_hour:   int   = Field(default=19, ge=14, le=22)

    # Scheduling constraints (forwarded to solver)
    allow_saturday: bool = Field(default=False)
    allow_sunday:   bool = Field(default=False)
    max_classroom:  int  = Field(default=20, ge=5, le=200)
    num_rooms:      int  = Field(default=2,  ge=1, le=2)

    @model_validator(mode="after")
    def resolve_window(self) -> "GeneratorProfile":
        if self.start_date and self.end_date:
            delta = (
                date.fromisoformat(self.end_date) -
                date.fromisoformat(self.start_date)
            ).days
            self.training_window_days = max(14, min(90, delta))
        elif self.training_window_days is None:
            self.training_window_days = 30
        return self

    def resolved_start_date(self) -> str:
        return self.start_date or date.today().isoformat()

    def deterministic_seed(self) -> int:
        payload = json.dumps(
            self.model_dump(exclude={"start_date", "end_date",
                                     "shift_pattern_ids", "shift_split"}),
            sort_keys=True,
        )
        return int(hashlib.sha256(payload.encode()).hexdigest(), 16) % (10 ** 8)
