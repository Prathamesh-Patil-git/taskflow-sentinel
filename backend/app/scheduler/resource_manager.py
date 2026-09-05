"""Reserves and releases worker resources as tasks are assigned and finished."""
from __future__ import annotations

from app.models.task import Task
from app.models.worker import Worker, WorkerStatus


def reserve(worker: Worker, task: Task) -> None:
    worker.cpu_usage = min(worker.cpu_capacity, worker.cpu_usage + task.cpu_required)
    worker.memory_usage = min(worker.memory_capacity, worker.memory_usage + task.memory_required)
    worker.active_tasks += 1
    _refresh_status(worker)


def release(worker: Worker, task: Task) -> None:
    worker.cpu_usage = max(0.0, worker.cpu_usage - task.cpu_required)
    worker.memory_usage = max(0.0, worker.memory_usage - task.memory_required)
    worker.active_tasks = max(0, worker.active_tasks - 1)
    _refresh_status(worker)


def _refresh_status(worker: Worker) -> None:
    if worker.status in (WorkerStatus.FAILED, WorkerStatus.OFFLINE):
        return
    load = max(worker.cpu_percent, worker.memory_percent)
    if load >= 90:
        worker.status = WorkerStatus.OVERLOADED
    elif worker.active_tasks > 0:
        worker.status = WorkerStatus.BUSY
    else:
        worker.status = WorkerStatus.ONLINE
