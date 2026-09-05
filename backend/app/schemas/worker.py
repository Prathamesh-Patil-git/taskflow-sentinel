from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.worker import WorkerStatus


class WorkerRegisterIn(BaseModel):
    worker_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    hostname: str = Field(default="localhost", max_length=255)
    cpu_capacity: float = Field(default=8, gt=0, le=256)
    memory_capacity: float = Field(default=16384, gt=0, le=1048576)
    region: str = Field(default="local", max_length=64)


class WorkerRegisterOut(BaseModel):
    worker_id: str
    status: WorkerStatus
    heartbeat_interval: int


class HeartbeatIn(BaseModel):
    cpu_usage: float = Field(ge=0)
    memory_usage: float = Field(ge=0)
    active_tasks: int = Field(default=0, ge=0)


class WorkerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    worker_id: str
    hostname: str
    region: str
    status: WorkerStatus
    cpu_capacity: float
    cpu_usage: float
    memory_capacity: float
    memory_usage: float
    cpu_percent: float
    memory_percent: float
    active_tasks: int
    total_tasks_completed: int
    total_tasks_failed: int
    reliability_score: float
    uptime_seconds: int
    last_heartbeat: datetime | None
    registered_at: datetime
