"""Scheduler state, decisions and algorithm switching."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_event import SystemEvent
from app.scheduler.engine import get_config, scheduler_engine
from app.scheduler.queue_manager import queue_manager
from app.services import resource_service
from app.utils.metrics import average, safe_ratio
from app.utils.time import utcnow
from app.websocket import events


async def decisions(session: AsyncSession, limit: int = 25) -> list[dict]:
    stmt = (
        select(SystemEvent)
        .where(SystemEvent.event_type == "SCHEDULER_DECISION")
        .order_by(SystemEvent.created_at.desc())
        .limit(limit)
    )
    rows = list((await session.execute(stmt)).scalars())
    payload = []
    for row in rows:
        meta = row.event_metadata or {}
        payload.append(
            {
                "task_id": row.task_id or "",
                "task_name": meta.get("task_name", ""),
                "cpu_required": meta.get("cpu_required", 0),
                "memory_required": meta.get("memory_required", 0),
                "scores": meta.get("scores", []),
                "selected_worker_id": meta.get("selected_worker_id"),
                "algorithm": meta.get("algorithm", "RESOURCE_AWARE"),
                "at": row.created_at,
            }
        )
    return payload


async def state(session: AsyncSession) -> dict:
    config = await get_config(session)
    since = utcnow() - timedelta(minutes=5)
    recent = (
        await session.execute(
            select(SystemEvent).where(
                SystemEvent.event_type == "SCHEDULER_DECISION", SystemEvent.created_at >= since
            )
        )
    ).scalars()
    recent_list = list(recent)
    latencies = [(e.event_metadata or {}).get("latency", 0) for e in recent_list]

    return {
        "algorithm": config.algorithm,
        "queue_depth": await queue_manager.depth(),
        "scheduling_rate": round(len(recent_list) / 5, 2),  # decisions per minute
        "average_latency": average(latencies)
        or round(
            safe_ratio(config.total_scheduling_latency, max(1, config.tasks_scheduled)), 2
        ),
        "efficiency": await resource_service.scheduler_efficiency(session),
        "tasks_scheduled": config.tasks_scheduled,
        "successful_assignments": config.successful_assignments,
        "rejected_assignments": config.rejected_assignments,
        "decisions": await decisions(session),
    }


async def set_algorithm(session: AsyncSession, algorithm: str) -> dict:
    config = await get_config(session)
    config.algorithm = algorithm.upper()
    await events.emit(
        session,
        "SCHEDULER_ALGORITHM_CHANGED",
        component="scheduler",
        message=f"Scheduling algorithm switched to {config.algorithm}",
    )
    return await state(session)


async def force_tick(session: AsyncSession, batch: int = 10) -> int:
    """Used by tests and manual triggers."""
    return await scheduler_engine.tick(session, batch=batch)
