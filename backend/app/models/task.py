from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TaskPriority(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

    @property
    def weight(self) -> int:
        return {"CRITICAL": 100, "HIGH": 75, "MEDIUM": 50, "LOW": 25}[self.value]


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"
    CANCELLED = "CANCELLED"


#: Only these state transitions are allowed (prevents duplicate/invalid execution).
ALLOWED_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.PENDING: {TaskStatus.QUEUED, TaskStatus.CANCELLED},
    TaskStatus.QUEUED: {TaskStatus.SCHEDULED, TaskStatus.CANCELLED},
    TaskStatus.SCHEDULED: {TaskStatus.RUNNING, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.RUNNING: {TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.FAILED: {TaskStatus.RETRYING},
    TaskStatus.RETRYING: {TaskStatus.QUEUED, TaskStatus.CANCELLED},
    TaskStatus.COMPLETED: set(),
    TaskStatus.CANCELLED: set(),
}


def can_transition(current: TaskStatus, target: TaskStatus) -> bool:
    return target in ALLOWED_TRANSITIONS[current]


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    task_type: Mapped[str] = mapped_column(String(32), default="RANDOM_TASK")
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, native_enum=False), default=TaskPriority.MEDIUM, index=True
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, native_enum=False), default=TaskStatus.PENDING, index=True
    )
    cpu_required: Mapped[float] = mapped_column(Float, default=1)
    memory_required: Mapped[float] = mapped_column(Float, default=512)
    estimated_duration: Mapped[float] = mapped_column(Float, default=10)
    actual_duration: Mapped[float | None] = mapped_column(Float)
    assigned_worker_id: Mapped[str | None] = mapped_column(String(64), index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    result: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
