from __future__ import annotations

from pydantic import BaseModel


class WorkerResource(BaseModel):
    worker_id: str
    status: str
    cpu_percent: float
    memory_percent: float
    active_tasks: int
    load: float


class ResourcePoint(BaseModel):
    t: int
    cpu: float
    memory: float
    running: int
    completed: int
    failed: int
    submitted: int
    throughput: float


class ResourceOverview(BaseModel):
    cpu_utilization: float
    memory_utilization: float
    storage_utilization: float
    network_utilization: float
    workers: list[WorkerResource]
    series: list[ResourcePoint]
    task_distribution: list[dict]
