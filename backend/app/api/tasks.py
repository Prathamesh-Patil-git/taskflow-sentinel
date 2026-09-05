"""Task REST API plus the worker execution callbacks."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.task import TaskAttemptOut, TaskCreate, TaskOut
from app.services import analytics_service, task_service
from app.utils.time import epoch_ms

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut], summary="List tasks with optional filters")
async def list_tasks(
    status: str | None = Query(default=None, description="PENDING, RUNNING, ..."),
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    return await task_service.list_tasks(session, status=status, search=search, limit=limit)


@router.post("", response_model=TaskOut, status_code=201, summary="Submit a new task")
async def create_task(payload: TaskCreate, session: AsyncSession = Depends(get_session)):
    task = await task_service.create_task(session, payload)
    await session.commit()
    await session.refresh(task)
    return task


@router.get("/{task_id}", summary="Task detail with attempts and lifecycle events")
async def get_task(task_id: str, session: AsyncSession = Depends(get_session)):
    task = await task_service.get_task(session, task_id)
    attempts = await task_service.list_attempts(session, task_id)
    events = await analytics_service.logs(session, search=task_id, limit=50)
    return {
        **TaskOut.model_validate(task).model_dump(),
        "attempts": [TaskAttemptOut.model_validate(a).model_dump() for a in attempts],
        "events": [
            {
                "at": epoch_ms(e.created_at),
                "level": e.level,
                "message": e.message,
                "component": e.component,
            }
            for e in events
        ],
    }


@router.post("/{task_id}/cancel", response_model=TaskOut, summary="Cancel a task")
async def cancel_task(task_id: str, session: AsyncSession = Depends(get_session)):
    task = await task_service.cancel_task(session, task_id)
    await session.commit()
    return task


@router.post("/{task_id}/retry", response_model=TaskOut, summary="Manually retry a task")
async def retry_task(task_id: str, session: AsyncSession = Depends(get_session)):
    task = await task_service.retry_task(session, task_id)
    await session.commit()
    return task


# ---- worker runtime callbacks -------------------------------------------
@router.post("/{task_id}/start", response_model=TaskOut, summary="Worker: task started")
async def start_task(
    task_id: str,
    worker_id: str = Body(embed=True),
    session: AsyncSession = Depends(get_session),
):
    task = await task_service.start_task(session, task_id, worker_id)
    await session.commit()
    return task


@router.post("/{task_id}/complete", response_model=TaskOut, summary="Worker: task completed")
async def complete_task(
    task_id: str,
    worker_id: str = Body(embed=True),
    result: str | None = Body(default=None, embed=True),
    session: AsyncSession = Depends(get_session),
):
    task = await task_service.complete_task(session, task_id, worker_id, result)
    await session.commit()
    return task


@router.post("/{task_id}/fail", response_model=TaskOut, summary="Worker: task failed")
async def fail_task(
    task_id: str,
    worker_id: str = Body(embed=True),
    error_message: str = Body(default="execution error", embed=True),
    session: AsyncSession = Depends(get_session),
):
    task = await task_service.fail_task(session, task_id, worker_id, error_message)
    await session.commit()
    return task
