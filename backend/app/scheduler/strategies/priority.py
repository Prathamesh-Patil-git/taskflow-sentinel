from __future__ import annotations

from app.models.task import Task, TaskPriority
from app.models.worker import Worker
from app.scheduler.strategies.base import SchedulerStrategy, WorkerScore


class PriorityBasedStrategy(SchedulerStrategy):
    """High priority tasks go to the most reliable, least loaded workers."""

    name = "PRIORITY_BASED"

    def score(self, task: Task, workers: list[Worker]) -> list[WorkerScore]:
        weight = TaskPriority(task.priority).weight / 100
        max_tasks = max((w.active_tasks for w in workers), default=0) or 1
        results: list[WorkerScore] = []
        for worker in workers:
            reliability = min(1.0, worker.reliability_score / 100)
            headroom = max(0.0, (worker.cpu_capacity - worker.cpu_usage) / worker.cpu_capacity)
            idleness = 1 - worker.active_tasks / max_tasks
            value = weight * (0.6 * reliability + 0.4 * headroom) + (1 - weight) * idleness
            results.append(WorkerScore(worker.worker_id, round(min(1.0, value), 4)))
        return results
