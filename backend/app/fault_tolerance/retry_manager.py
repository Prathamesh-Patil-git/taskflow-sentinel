"""Retry policy helpers used by the recovery paths."""
from __future__ import annotations

from app.core.config import settings
from app.models.task import Task


def retries_remaining(task: Task) -> int:
    return max(0, min(task.max_retries, settings.max_task_retries) - task.retry_count)


def should_retry(task: Task) -> bool:
    return retries_remaining(task) > 0


def backoff_seconds(task: Task, base: float = 1.0, cap: float = 30.0) -> float:
    return min(cap, base * (2 ** max(0, task.retry_count - 1)))
