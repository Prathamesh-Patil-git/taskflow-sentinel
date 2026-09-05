from __future__ import annotations

from app.models.task import Task
from app.models.worker import Worker
from app.scheduler.strategies.base import SchedulerStrategy, WorkerScore


class LeastLoadedStrategy(SchedulerStrategy):
    """Prefers the worker running the fewest tasks / lowest CPU load."""

    name = "LEAST_LOADED"

    def score(self, task: Task, workers: list[Worker]) -> list[WorkerScore]:
        max_tasks = max((w.active_tasks for w in workers), default=0) or 1
        return [
            WorkerScore(
                w.worker_id,
                round(
                    0.6 * (1 - w.active_tasks / max_tasks)
                    + 0.4 * (1 - min(1.0, w.cpu_usage / w.cpu_capacity)),
                    4,
                ),
            )
            for w in workers
        ]
