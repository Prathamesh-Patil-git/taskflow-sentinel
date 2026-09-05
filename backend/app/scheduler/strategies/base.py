"""Strategy interface — algorithms are swappable without touching the engine."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import settings
from app.models.task import Task
from app.models.worker import Worker, WorkerStatus
from app.utils.time import seconds_since


@dataclass(slots=True)
class WorkerScore:
    worker_id: str
    score: float


def is_eligible(worker: Worker, task: Task) -> bool:
    """Reject workers that cannot satisfy the task or are not healthy."""
    if worker.status in (WorkerStatus.FAILED, WorkerStatus.OFFLINE):
        return False
    if seconds_since(worker.last_heartbeat) > settings.failure_timeout:
        return False
    if worker.cpu_capacity - worker.cpu_usage < task.cpu_required:
        return False
    if worker.memory_capacity - worker.memory_usage < task.memory_required:
        return False
    return True


class SchedulerStrategy(ABC):
    name: str = "BASE"

    def eligible(self, task: Task, workers: list[Worker]) -> list[Worker]:
        return [w for w in workers if is_eligible(w, task)]

    @abstractmethod
    def score(self, task: Task, workers: list[Worker]) -> list[WorkerScore]:
        """Score every eligible worker between 0 and 1."""

    def select_worker(
        self, task: Task, workers: list[Worker]
    ) -> tuple[Worker | None, list[WorkerScore]]:
        candidates = self.eligible(task, workers)
        if not candidates:
            return None, []
        scores = self.score(task, candidates)
        if not scores:
            return None, []
        best = max(scores, key=lambda s: s.score)
        winner = next((w for w in candidates if w.worker_id == best.worker_id), None)
        return winner, sorted(scores, key=lambda s: s.score, reverse=True)
