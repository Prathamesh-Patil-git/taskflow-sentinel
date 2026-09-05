"""Heartbeat freshness helpers."""
from __future__ import annotations

from app.core.config import settings
from app.models.worker import Worker
from app.utils.time import seconds_since


def heartbeat_age(worker: Worker) -> float:
    return seconds_since(worker.last_heartbeat)


def is_stale(worker: Worker, timeout: float | None = None) -> bool:
    return heartbeat_age(worker) > (timeout or settings.failure_timeout)


def heartbeat_health(worker: Worker) -> float:
    """1.0 = fresh, 0.0 = past the failure timeout."""
    age = heartbeat_age(worker)
    if age == float("inf"):
        return 0.0
    return max(0.0, 1 - min(1.0, age / max(1, settings.failure_timeout)))
