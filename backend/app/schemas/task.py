from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskPriority, TaskStatus

TASK_TYPES = ("CPU_TASK", "MEMORY_TASK", "SLEEP_TASK", "FAILURE_TASK", "RANDOM_TASK")


class TaskCreate(BaseModel):
    """Payload for POST /api/tasks."""

    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    task_type: str = Field(default="RANDOM_TASK", pattern="|".join(TASK_TYPES))
    priority: TaskPriority = TaskPriority.MEDIUM
    cpu_required: float = Field(default=1, gt=0, le=64)
    memory_required: float = Field(default=512, gt=0, le=262144)
    estimated_duration: float = Field(default=10, gt=0, le=3600)
    max_retries: int = Field(default=3, ge=0, le=10)


class TaskAttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attempt_number: int
    worker_id: str | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    execution_time: float | None
    error_message: str | None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: str
    name: str
    description: str | None
    task_type: str
    priority: TaskPriority
    status: TaskStatus
    cpu_required: float
    memory_required: float
    estimated_duration: float
    actual_duration: float | None
    assigned_worker_id: str | None
    retry_count: int
    max_retries: int
    created_at: datetime
    queued_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    failed_at: datetime | None
    result: str | None
    error_message: str | None


class TaskDetailOut(TaskOut):
    attempts: list[TaskAttemptOut] = []
    events: list[dict] = []
