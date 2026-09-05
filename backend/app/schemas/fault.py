from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.fault import FaultSeverity, FaultStatus, FaultType


class FaultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fault_id: str
    worker_id: str | None
    fault_type: FaultType
    severity: FaultSeverity
    status: FaultStatus
    detected_at: datetime
    recovered_at: datetime | None
    affected_tasks: int
    recovery_time: float | None
    description: str | None
    events: list[dict] = []


class FaultSummary(BaseModel):
    active_failures: int
    failures_today: int
    recovered_automatically: int
    recovery_rate: float
    average_recovery_time: float
    faults: list[FaultOut]
