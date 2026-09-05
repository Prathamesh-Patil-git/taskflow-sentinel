from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WorkerStatus(str, enum.Enum):
    ONLINE = "ONLINE"
    BUSY = "BUSY"
    OVERLOADED = "OVERLOADED"
    FAILED = "FAILED"
    OFFLINE = "OFFLINE"


class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    worker_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hostname: Mapped[str] = mapped_column(String(255), default="localhost")
    status: Mapped[WorkerStatus] = mapped_column(
        Enum(WorkerStatus, native_enum=False), default=WorkerStatus.ONLINE, index=True
    )
    cpu_capacity: Mapped[float] = mapped_column(Float, default=8)
    cpu_usage: Mapped[float] = mapped_column(Float, default=0)
    memory_capacity: Mapped[float] = mapped_column(Float, default=16384)
    memory_usage: Mapped[float] = mapped_column(Float, default=0)
    active_tasks: Mapped[int] = mapped_column(Integer, default=0)
    total_tasks_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_tasks_failed: Mapped[int] = mapped_column(Integer, default=0)
    reliability_score: Mapped[float] = mapped_column(Float, default=100)
    uptime_seconds: Mapped[int] = mapped_column(Integer, default=0)
    region: Mapped[str] = mapped_column(String(64), default="local")
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def cpu_percent(self) -> float:
        return round(min(100.0, (self.cpu_usage / self.cpu_capacity) * 100), 1) if self.cpu_capacity else 0.0

    @property
    def memory_percent(self) -> float:
        return (
            round(min(100.0, (self.memory_usage / self.memory_capacity) * 100), 1)
            if self.memory_capacity
            else 0.0
        )
