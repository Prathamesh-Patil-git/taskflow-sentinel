"""Fault records, fault timeline and failure simulation."""
from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fault import Fault, FaultSeverity, FaultStatus, FaultType
from app.models.system_event import SystemEvent
from app.models.worker import Worker, WorkerStatus
from app.core.config import settings
from app.services import recovery_service, worker_service
from app.websocket import events
from app.utils.metrics import average, percent
from app.utils.time import epoch_ms, utcnow


def new_fault_id() -> str:
    return f"F-{uuid.uuid4().hex[:8].upper()}"


async def create_fault(
    session: AsyncSession,
    *,
    worker_id: str,
    fault_type: FaultType,
    severity: FaultSeverity = FaultSeverity.ERROR,
    description: str = "",
) -> Fault:
    fault = Fault(
        fault_id=new_fault_id(),
        worker_id=worker_id,
        fault_type=fault_type,
        severity=severity,
        status=FaultStatus.DETECTED,
        detected_at=utcnow(),
        description=description,
    )
    session.add(fault)
    await session.flush()
    return fault


async def list_faults(session: AsyncSession, limit: int = 100) -> list[Fault]:
    stmt = select(Fault).order_by(desc(Fault.detected_at)).limit(limit)
    return list((await session.execute(stmt)).scalars())


async def get_fault(session: AsyncSession, fault_id: str) -> Fault:
    fault = (
        await session.execute(select(Fault).where(Fault.fault_id == fault_id))
    ).scalar_one_or_none()
    if fault is None:
        raise HTTPException(status_code=404, detail="Fault not found")
    return fault


async def fault_timeline(session: AsyncSession, fault: Fault) -> list[dict]:
    """Real backend events recorded around the fault window."""
    window_end = (fault.recovered_at or utcnow()) + timedelta(seconds=5)
    stmt = (
        select(SystemEvent)
        .where(
            SystemEvent.created_at >= fault.detected_at - timedelta(seconds=5),
            SystemEvent.created_at <= window_end,
        )
        .order_by(SystemEvent.created_at)
        .limit(80)
    )
    rows = list((await session.execute(stmt)).scalars())
    tone = {"INFO": "info", "WARNING": "warning", "ERROR": "danger", "CRITICAL": "danger"}
    return [
        {
            "at": epoch_ms(row.created_at),
            "message": row.message,
            "tone": "success" if row.event_type.endswith("RECOVERED") else tone.get(row.level, "info"),
        }
        for row in rows
        if row.worker_id in (None, fault.worker_id) or row.event_type.startswith("TASK_")
    ]


async def fault_summary(session: AsyncSession) -> dict:
    faults = await list_faults(session, limit=200)
    today = utcnow().date()
    active = [f for f in faults if f.status in (FaultStatus.DETECTED, FaultStatus.RECOVERING)]
    today_faults = [f for f in faults if f.detected_at.date() == today]
    recovered = [f for f in faults if f.status is FaultStatus.RECOVERED]
    return {
        "active_failures": len(active),
        "failures_today": len(today_faults),
        "recovered_automatically": len(recovered),
        "recovery_rate": percent(len(recovered), len(faults)) if faults else 100.0,
        "average_recovery_time": average([f.recovery_time or 0 for f in recovered]),
    }


async def simulate_failure(
    session: AsyncSession, worker_id: str, *, immediate: bool = False
) -> dict:
    """Crash a worker for the demo.

    Default ("detector") mode flips a kill-switch: the real worker container
    stops sending heartbeats and stops picking up work, so the backend failure
    detector observes the timeout itself and drives the whole recovery
    pipeline. ``immediate`` mode short-circuits the timeout (used by tests and
    when no live runtime is attached).
    """
    worker = await worker_service.get_worker(session, worker_id)
    if worker.status is WorkerStatus.FAILED:
        raise HTTPException(status_code=409, detail="Worker is already FAILED")

    await worker_service.set_paused(worker_id, True)

    if not immediate:
        await events.emit(
            session,
            "WORKER_HEARTBEAT_SUSPENDED",
            component="fault-injector",
            worker_id=worker_id,
            message=(
                f"{worker_id} heartbeat suspended — failure detector will time it out "
                f"after {settings.failure_timeout}s"
            ),
            level="WARNING",
        )
        return {
            "mode": "detector",
            "worker_id": worker_id,
            "detects_in_seconds": settings.failure_timeout,
            "affected_tasks": 0,
            "requeued": [],
            "recovery_time": None,
        }

    worker.status = WorkerStatus.FAILED
    worker.last_heartbeat = utcnow() - timedelta(seconds=3600)
    worker.reliability_score = max(0.0, worker.reliability_score - 10)

    fault = await create_fault(
        session,
        worker_id=worker_id,
        fault_type=FaultType.WORKER_CRASH,
        severity=FaultSeverity.CRITICAL,
        description=f"Simulated crash of {worker_id}",
    )
    result = await recovery_service.recover_worker_tasks(session, worker, fault)
    return {"mode": "immediate", "fault": fault.fault_id, **result}


async def recover(session: AsyncSession, worker_id: str) -> Worker:
    return await worker_service.recover_worker(session, worker_id)
