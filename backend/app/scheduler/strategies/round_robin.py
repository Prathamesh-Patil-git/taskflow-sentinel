from __future__ import annotations

from itertools import count

from app.models.task import Task
from app.models.worker import Worker
from app.scheduler.strategies.base import SchedulerStrategy, WorkerScore


class RoundRobinStrategy(SchedulerStrategy):
    """Cycles through eligible workers in a stable order."""

    name = "ROUND_ROBIN"

    def __init__(self) -> None:
        self._counter = count()

    def score(self, task: Task, workers: list[Worker]) -> list[WorkerScore]:
        ordered = sorted(workers, key=lambda w: w.worker_id)
        index = next(self._counter) % len(ordered)
        return [
            WorkerScore(worker.worker_id, 1.0 if position == index else 0.0)
            for position, worker in enumerate(ordered)
        ]
