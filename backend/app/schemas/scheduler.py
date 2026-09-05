from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

ALGORITHMS = ("ROUND_ROBIN", "LEAST_LOADED", "RESOURCE_AWARE", "PRIORITY_BASED")


class AlgorithmUpdate(BaseModel):
    algorithm: str = Field(pattern="^(" + "|".join(ALGORITHMS) + ")$")


class WorkerScore(BaseModel):
    worker_id: str
    score: float


class SchedulerDecisionOut(BaseModel):
    task_id: str
    task_name: str
    cpu_required: float
    memory_required: float
    scores: list[WorkerScore]
    selected_worker_id: str | None
    algorithm: str
    at: datetime


class SchedulerStateOut(BaseModel):
    algorithm: str
    queue_depth: int
    scheduling_rate: float
    average_latency: float
    efficiency: float
    tasks_scheduled: int
    successful_assignments: int
    rejected_assignments: int
    decisions: list[SchedulerDecisionOut]
