"""Analytics computed from persisted task, attempt, fault and event history."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fault import Fault, FaultStatus
from app.models.system_event import SystemEvent
from app.models.task import Task, TaskStatus
from app.models.worker import Worker, WorkerStatus
from app.services import resource_service
from app.utils.metrics import average, percent
from app.utils.time import aware, utcnow


async def _tasks(session: AsyncSession) -> list[Task]:
    return list((await session.execute(select(Task))).scalars())


def _seconds(later, earlier) -> float | None:
    later, earlier = aware(later), aware(earlier)
    if not later or not earlier:
        return None
    return (later - earlier).total_seconds()


async def overview(session: AsyncSession) -> dict:
    tasks = await _tasks(session)
    workers = list((await session.execute(select(Worker))).scalars())
    completed = [t for t in tasks if t.status is TaskStatus.COMPLETED]
    failed = [t for t in tasks if t.status is TaskStatus.FAILED]
    finished = len(completed) + len(failed)
    retried = [t for t in tasks if t.retry_count > 0]

    faults = list((await session.execute(select(Fault))).scalars())
    recovered = [f for f in faults if f.status is FaultStatus.RECOVERED and f.recovery_time]

    exec_times = [t.actual_duration for t in completed if t.actual_duration]
    queue_times = [
        s for t in tasks if (s := _seconds(t.started_at, t.queued_at)) is not None and s >= 0
    ]
    sched_latency = [
        s for t in tasks if (s := _seconds(t.scheduled_at, t.queued_at)) is not None and s >= 0
    ]

    util = await resource_service.cluster_utilisation(session)
    live = [w for w in workers if w.status not in (WorkerStatus.FAILED, WorkerStatus.OFFLINE)]
    busy = [w for w in live if w.active_tasks > 0]

    return {
        "total_tasks": len(tasks),
        "success_rate": percent(len(completed), finished) if finished else 0.0,
        "failure_rate": percent(len(failed), finished) if finished else 0.0,
        "retry_rate": percent(len(retried), len(tasks)) if tasks else 0.0,
        "average_execution_time": average(exec_times),
        "average_queue_time": average(queue_times),
        "average_scheduling_latency": average(sched_latency),
        "average_recovery_time": average([f.recovery_time for f in recovered]),
        "throughput": await resource_service.throughput(session),
        "cpu_utilization": util["cpu_utilization"],
        "memory_utilization": util["memory_utilization"],
        "worker_utilization": percent(len(busy), len(live)) if live else 0.0,
        "worker_availability": percent(len(live), len(workers)) if workers else 0.0,
    }


async def task_analytics(session: AsyncSession, hours: int = 24) -> list[dict]:
    """Hourly buckets of submitted / completed / failed tasks."""
    since = utcnow() - timedelta(hours=hours)
    tasks = [t for t in await _tasks(session) if aware(t.created_at) and aware(t.created_at) >= since]
    buckets: dict[str, dict] = {}
    for task in tasks:
        key = aware(task.created_at).replace(minute=0, second=0, microsecond=0).isoformat()
        bucket = buckets.setdefault(
            key, {"bucket": key, "submitted": 0, "completed": 0, "failed": 0}
        )
        bucket["submitted"] += 1
        if task.status is TaskStatus.COMPLETED:
            bucket["completed"] += 1
        elif task.status is TaskStatus.FAILED:
            bucket["failed"] += 1
    return sorted(buckets.values(), key=lambda b: b["bucket"])


async def resource_analytics(session: AsyncSession) -> dict:
    return await resource_service.resource_overview(session)


async def scheduling_comparison(session: AsyncSession) -> list[dict]:
    """Per-algorithm metrics derived from recorded SCHEDULER_DECISION events."""
    rows = list(
        (
            await session.execute(
                select(SystemEvent).where(SystemEvent.event_type == "SCHEDULER_DECISION")
            )
        ).scalars()
    )
    tasks = {t.task_id: t for t in await _tasks(session)}
    util = await resource_service.cluster_utilisation(session)

    grouped: dict[str, list[SystemEvent]] = {}
    for row in rows:
        algorithm = (row.event_metadata or {}).get("algorithm", "RESOURCE_AWARE")
        grouped.setdefault(algorithm, []).append(row)

    results: list[dict] = []
    for algorithm, events in grouped.items():
        latencies = [(e.event_metadata or {}).get("latency", 0) for e in events]
        related = [tasks.get(e.task_id) for e in events if e.task_id in tasks]
        related = [t for t in related if t]
        completed = [t for t in related if t.status is TaskStatus.COMPLETED]
        failed = [t for t in related if t.status is TaskStatus.FAILED]
        finished = len(completed) + len(failed)
        queue_times = [
            s for t in related if (s := _seconds(t.started_at, t.queued_at)) is not None and s >= 0
        ]
        results.append(
            {
                "algorithm": algorithm,
                "average_completion_time": average(
                    [t.actual_duration for t in completed if t.actual_duration]
                ),
                "average_queue_time": average(queue_times),
                "cpu_utilization": util["cpu_utilization"],
                "memory_utilization": util["memory_utilization"],
                "scheduling_latency": average(latencies),
                "failure_rate": percent(len(failed), finished) if finished else 0.0,
                "throughput": round(len(completed) / max(1, len(events)) * 100, 2),
            }
        )
    return sorted(results, key=lambda r: r["algorithm"])


async def logs(
    session: AsyncSession,
    *,
    level: str | None = None,
    worker_id: str | None = None,
    search: str | None = None,
    limit: int = 300,
) -> list[SystemEvent]:
    stmt = select(SystemEvent).order_by(SystemEvent.created_at.desc()).limit(min(limit, 1000))
    if level:
        stmt = stmt.where(SystemEvent.level == level.upper())
    if worker_id:
        stmt = stmt.where(SystemEvent.worker_id == worker_id)
    if search:
        stmt = stmt.where(func.lower(SystemEvent.message).like(f"%{search.lower()}%"))
    return list((await session.execute(stmt)).scalars())
