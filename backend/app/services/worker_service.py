"""Worker registration, heartbeats, failure simulation and recovery."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis import redis_gateway
from app.models.worker import Worker, WorkerStatus
from app.schemas.worker import HeartbeatIn, WorkerRegisterIn
from app.utils.time import utcnow
from app.websocket import events


async def list_workers(session: AsyncSession) -> list[Worker]:
    return list((await session.execute(select(Worker).order_by(Worker.worker_id))).scalars())


async def get_worker(session: AsyncSession, worker_id: str) -> Worker:
    worker = (
        await session.execute(select(Worker).where(Worker.worker_id == worker_id))
    ).scalar_one_or_none()
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker


async def _cache(worker: Worker) -> None:
    await redis_gateway.cache_worker(
        worker.worker_id,
        {
            "worker_id": worker.worker_id,
            "status": worker.status.value,
            "cpu_usage": worker.cpu_usage,
            "memory_usage": worker.memory_usage,
            "active_tasks": worker.active_tasks,
            "last_heartbeat": worker.last_heartbeat.isoformat() if worker.last_heartbeat else "",
        },
    )


async def register_worker(session: AsyncSession, payload: WorkerRegisterIn) -> Worker:
    worker = (
        await session.execute(select(Worker).where(Worker.worker_id == payload.worker_id))
    ).scalar_one_or_none()
    if worker is None:
        worker = Worker(worker_id=payload.worker_id, registered_at=utcnow())
        session.add(worker)

    worker.hostname = payload.hostname
    worker.region = payload.region
    worker.cpu_capacity = payload.cpu_capacity
    worker.memory_capacity = payload.memory_capacity
    worker.status = WorkerStatus.ONLINE
    worker.cpu_usage = 0
    worker.memory_usage = 0
    worker.active_tasks = 0
    worker.last_heartbeat = utcnow()
    await session.flush()
    await _cache(worker)

    await events.emit(
        session,
        events.WORKER_REGISTERED,
        component="worker-manager",
        worker_id=worker.worker_id,
        message=f"{worker.worker_id} registered ({worker.hostname})",
        data={"cpu_capacity": worker.cpu_capacity, "memory_capacity": worker.memory_capacity},
    )
    return worker


async def heartbeat(session: AsyncSession, worker_id: str, payload: HeartbeatIn) -> Worker:
    worker = await get_worker(session, worker_id)
    if worker.status is WorkerStatus.FAILED:
        # A crashed/simulated-failed worker must be recovered explicitly.
        raise HTTPException(status_code=409, detail="Worker is marked FAILED; call /recover first")

    worker.cpu_usage = min(payload.cpu_usage, worker.cpu_capacity)
    worker.memory_usage = min(payload.memory_usage, worker.memory_capacity)
    worker.active_tasks = payload.active_tasks
    if payload.cpu_count:
        worker.cpu_capacity = float(payload.cpu_count)
    if payload.uptime_seconds is not None:
        worker.uptime_seconds = int(payload.uptime_seconds)
    else:
        worker.uptime_seconds += settings.heartbeat_interval
    worker.last_heartbeat = utcnow()
    if worker.status is WorkerStatus.OFFLINE:
        worker.status = WorkerStatus.ONLINE
    if max(worker.cpu_percent, worker.memory_percent) >= 90:
        worker.status = WorkerStatus.OVERLOADED
    elif worker.active_tasks > 0:
        worker.status = WorkerStatus.BUSY
    else:
        worker.status = WorkerStatus.ONLINE

    await _cache(worker)
    await events.emit(
        session,
        events.WORKER_HEARTBEAT,
        component="heartbeat",
        worker_id=worker.worker_id,
        message=f"heartbeat {worker.worker_id} cpu={worker.cpu_percent}% mem={worker.memory_percent}%",
        data={
            "cpu_percent": worker.cpu_percent,
            "memory_percent": worker.memory_percent,
            "active_tasks": worker.active_tasks,
            "status": worker.status.value,
        },
        persist=False,
    )
    await events.emit(
        session,
        events.RESOURCE_UPDATED,
        component="resource-manager",
        worker_id=worker.worker_id,
        message="resource snapshot updated",
        data={"cpu_percent": worker.cpu_percent, "memory_percent": worker.memory_percent},
        persist=False,
    )
    return worker


async def set_paused(worker_id: str, paused: bool) -> None:
    """Flip the worker runtime kill-switch used by the failure simulation."""
    await redis_gateway.set_worker_paused(worker_id, paused)


async def is_paused(worker_id: str) -> bool:
    return await redis_gateway.worker_paused(worker_id)


async def recover_worker(session: AsyncSession, worker_id: str) -> Worker:
    worker = await get_worker(session, worker_id)
    worker.status = WorkerStatus.ONLINE
    worker.cpu_usage = 0
    worker.memory_usage = 0
    worker.active_tasks = 0
    worker.last_heartbeat = utcnow()
    await set_paused(worker_id, False)
    await _cache(worker)
    await events.emit(
        session,
        events.WORKER_RECOVERED,
        component="recovery",
        worker_id=worker.worker_id,
        message=f"{worker.worker_id} back ONLINE",
    )
    return worker
