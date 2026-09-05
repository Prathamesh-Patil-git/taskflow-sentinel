"""Cluster resource utilisation, time series sampling and health calculation."""
from __future__ import annotations

import asyncio
from collections import deque
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import SessionLocal, check_database
from app.core.redis import redis_gateway
from app.models.task import Task, TaskStatus
from app.models.worker import Worker, WorkerStatus
from app.scheduler.queue_manager import queue_manager
from app.utils.metrics import average, clamp, percent
from app.utils.time import epoch_ms, utcnow

#: Rolling in-process time series (also survives as task history in Postgres).
SERIES: deque[dict] = deque(maxlen=180)


async def cluster_utilisation(session: AsyncSession) -> dict:
    workers = list((await session.execute(select(Worker))).scalars())
    live = [w for w in workers if w.status not in (WorkerStatus.FAILED, WorkerStatus.OFFLINE)]
    cpu_capacity = sum(w.cpu_capacity for w in live)
    memory_capacity = sum(w.memory_capacity for w in live)
    return {
        "cpu_utilization": percent(sum(w.cpu_usage for w in live), cpu_capacity),
        "memory_utilization": percent(sum(w.memory_usage for w in live), memory_capacity),
        "workers": workers,
        "live_workers": live,
    }


async def task_counts(session: AsyncSession) -> dict[str, int]:
    rows = await session.execute(select(Task.status, func.count()).group_by(Task.status))
    counts = {status.value: 0 for status in TaskStatus}
    for status, total in rows:
        counts[status.value if hasattr(status, "value") else str(status)] = int(total)
    counts["TOTAL"] = sum(counts[s.value] for s in TaskStatus)
    return counts


async def throughput(session: AsyncSession, window_seconds: int = 300) -> float:
    since = utcnow() - timedelta(seconds=window_seconds)
    completed = (
        await session.execute(
            select(func.count()).select_from(Task).where(Task.completed_at >= since)
        )
    ).scalar_one()
    return round(float(completed) * 60 / window_seconds, 2)  # tasks / minute


async def scheduler_efficiency(session: AsyncSession) -> float:
    from app.scheduler.engine import get_config

    config = await get_config(session)
    attempts = config.successful_assignments + config.rejected_assignments
    if attempts == 0:
        return 100.0
    base = percent(config.successful_assignments, attempts)
    depth = await queue_manager.depth()
    return round(clamp(base - min(20.0, depth * 0.5)), 1)


async def system_health(session: AsyncSession) -> dict:
    from app.fault_tolerance.failure_detector import failure_detector
    from app.scheduler.engine import scheduler_engine

    workers = list((await session.execute(select(Worker))).scalars())
    live = [w for w in workers if w.status not in (WorkerStatus.FAILED, WorkerStatus.OFFLINE)]
    availability = percent(len(live), len(workers)) if workers else 100.0

    counts = await task_counts(session)
    finished = counts["COMPLETED"] + counts["FAILED"]
    failure_rate = percent(counts["FAILED"], finished) if finished else 0.0
    depth = await queue_manager.depth()

    database_ok = await check_database()
    redis_ok = await redis_gateway.healthy()
    scheduler_ok = scheduler_engine.healthy
    detector_ok = failure_detector.healthy

    overall = clamp(
        0.45 * availability
        + 0.20 * (100 if scheduler_ok and detector_ok else 40)
        + 0.15 * (100 - min(100.0, depth * 2))
        + 0.10 * (100 if database_ok else 0)
        + 0.10 * (100 - min(100.0, failure_rate * 2))
    )

    def state(ok: bool, warn: bool = False) -> str:
        return "HEALTHY" if ok and not warn else ("DEGRADED" if ok else "DOWN")

    return {
        "overall": round(overall),
        "scheduler": state(scheduler_ok),
        "workers": state(availability > 0, availability < 70),
        "queue": state(True, depth > 25),
        "database": state(database_ok),
        "redis": state(redis_ok, redis_gateway.degraded),
    }


async def sample(session: AsyncSession) -> dict:
    """Append one point to the rolling series."""
    util = await cluster_utilisation(session)
    counts = await task_counts(session)
    since = utcnow() - timedelta(seconds=10)
    submitted = (
        await session.execute(
            select(func.count()).select_from(Task).where(Task.created_at >= since)
        )
    ).scalar_one()
    point = {
        "t": epoch_ms(utcnow()),
        "cpu": util["cpu_utilization"],
        "memory": util["memory_utilization"],
        "running": counts["RUNNING"],
        "completed": counts["COMPLETED"],
        "failed": counts["FAILED"],
        "submitted": int(submitted),
        "throughput": await throughput(session),
    }
    SERIES.append(point)
    return point


async def resource_overview(session: AsyncSession) -> dict:
    util = await cluster_utilisation(session)
    workers = util["workers"]
    counts = await task_counts(session)
    return {
        "cpu_utilization": util["cpu_utilization"],
        "memory_utilization": util["memory_utilization"],
        "storage_utilization": round(
            clamp(percent(counts["TOTAL"], max(1, counts["TOTAL"] + 400))), 1
        ),
        "network_utilization": round(
            clamp(average([w.active_tasks * 8.0 for w in workers])), 1
        ),
        "workers": [
            {
                "worker_id": w.worker_id,
                "status": w.status.value,
                "cpu_percent": w.cpu_percent,
                "memory_percent": w.memory_percent,
                "active_tasks": w.active_tasks,
                "load": round((w.cpu_percent + w.memory_percent) / 2, 1),
            }
            for w in workers
        ],
        "series": list(SERIES),
        "task_distribution": [
            {"worker_id": w.worker_id, "active": w.active_tasks, "completed": w.total_tasks_completed}
            for w in workers
        ],
    }


class MetricSampler:
    """Background sampler feeding the resource time series."""

    def __init__(self, interval: float = 5.0) -> None:
        self.interval = interval
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._task is None:
            self._running = True
            self._task = asyncio.create_task(self._loop(), name="metric-sampler")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None

    async def _loop(self) -> None:
        while self._running:
            try:
                async with SessionLocal() as session:
                    await sample(session)
            except asyncio.CancelledError:
                raise
            except Exception:
                pass
            await asyncio.sleep(self.interval)


metric_sampler = MetricSampler(interval=max(2.0, settings.heartbeat_interval * 2))
