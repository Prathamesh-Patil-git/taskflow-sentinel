from __future__ import annotations

from app.core.config import settings
from app.models.task import Task
from app.models.worker import Worker
from app.scheduler.strategies.base import SchedulerStrategy, WorkerScore
from app.utils.time import seconds_since


class ResourceAwareStrategy(SchedulerStrategy):
    """Weighted multi-factor score (default algorithm).

    score = 0.40*cpu + 0.30*memory + 0.15*reliability + 0.10*load + 0.05*heartbeat
    """

    name = "RESOURCE_AWARE"

    def score(self, task: Task, workers: list[Worker]) -> list[WorkerScore]:
        max_tasks = max((w.active_tasks for w in workers), default=0) or 1
        results: list[WorkerScore] = []
        for worker in workers:
            cpu_availability = max(0.0, (worker.cpu_capacity - worker.cpu_usage) / worker.cpu_capacity)
            memory_availability = max(
                0.0, (worker.memory_capacity - worker.memory_usage) / worker.memory_capacity
            )
            reliability = min(1.0, max(0.0, worker.reliability_score / 100))
            load_balance = 1 - (worker.active_tasks / max_tasks)
            age = seconds_since(worker.last_heartbeat)
            heartbeat_health = max(0.0, 1 - min(1.0, age / max(1, settings.failure_timeout)))

            value = (
                0.40 * cpu_availability
                + 0.30 * memory_availability
                + 0.15 * reliability
                + 0.10 * load_balance
                + 0.05 * heartbeat_health
            )
            results.append(WorkerScore(worker.worker_id, round(min(1.0, max(0.0, value)), 4)))
        return results
