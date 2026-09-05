"""Worker registration, heartbeat, assignments, failure simulation and recovery."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.schemas.task import TaskOut
from app.schemas.worker import (
    HeartbeatIn,
    WorkerControl,
    WorkerOut,
    WorkerRegisterIn,
    WorkerRegisterOut,
)
from app.services import fault_service, task_service, worker_service

router = APIRouter(prefix="/api/workers", tags=["workers"])


@router.get("", response_model=list[WorkerOut], summary="List cluster workers")
async def list_workers(session: AsyncSession = Depends(get_session)):
    return await worker_service.list_workers(session)


@router.post("/register", response_model=WorkerRegisterOut, summary="Register a worker node")
async def register(payload: WorkerRegisterIn, session: AsyncSession = Depends(get_session)):
    worker = await worker_service.register_worker(session, payload)
    await session.commit()
    return WorkerRegisterOut(
        worker_id=worker.worker_id,
        status=worker.status,
        heartbeat_interval=settings.heartbeat_interval,
    )


@router.get("/{worker_id}", response_model=WorkerOut, summary="Worker detail")
async def get_worker(worker_id: str, session: AsyncSession = Depends(get_session)):
    return await worker_service.get_worker(session, worker_id)


@router.post("/{worker_id}/heartbeat", response_model=WorkerOut, summary="Worker heartbeat")
async def heartbeat(
    worker_id: str, payload: HeartbeatIn, session: AsyncSession = Depends(get_session)
):
    worker = await worker_service.heartbeat(session, worker_id, payload)
    await session.commit()
    return worker


@router.get(
    "/{worker_id}/assignments",
    response_model=list[TaskOut],
    summary="Tasks scheduled for this worker",
)
async def assignments(worker_id: str, session: AsyncSession = Depends(get_session)):
    return await task_service.assignments_for_worker(session, worker_id)


@router.get(
    "/{worker_id}/control",
    response_model=WorkerControl,
    summary="Runtime kill-switch polled by the worker container",
)
async def control(worker_id: str):
    return WorkerControl(
        worker_id=worker_id,
        paused=await worker_service.is_paused(worker_id),
        heartbeat_interval=settings.heartbeat_interval,
    )


@router.post("/{worker_id}/simulate-failure", summary="Simulate a worker crash")
async def simulate_failure(
    worker_id: str,
    mode: str = Query(
        default="detector",
        pattern="^(detector|immediate)$",
        description="detector = stop the real heartbeat and let the detector time it out",
    ),
    session: AsyncSession = Depends(get_session),
):
    result = await fault_service.simulate_failure(
        session, worker_id, immediate=mode == "immediate"
    )
    await session.commit()
    return result


@router.post("/{worker_id}/recover", response_model=WorkerOut, summary="Restore a failed worker")
async def recover(worker_id: str, session: AsyncSession = Depends(get_session)):
    worker = await fault_service.recover(session, worker_id)
    await session.commit()
    return worker
