"""Task lifecycle: creation, safe state transitions, execution callbacks."""
from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.task import Task, TaskStatus, can_transition
from app.models.task_attempt import TaskAttempt
from app.models.worker import Worker
from app.scheduler.queue_manager import queue_manager
from app.scheduler.resource_manager import release
from app.schemas.task import TaskCreate
from app.utils.time import seconds_since, utcnow
from app.websocket import events


def new_task_id() -> str:
    return f"T-{uuid.uuid4().hex[:8].upper()}"


def transition(task: Task, target: TaskStatus) -> None:
    if task.status is target:
        return
    if not can_transition(task.status, target):
        raise HTTPException(
            status_code=409,
            detail=f"Invalid transition {task.status.value} -> {target.value} for {task.task_id}",
        )
    task.status = target


async def create_task(session: AsyncSession, payload: TaskCreate) -> Task:
    task = Task(
        task_id=new_task_id(),
        name=payload.name,
        description=payload.description,
        task_type=payload.task_type,
        priority=payload.priority,
        cpu_required=payload.cpu_required,
        memory_required=payload.memory_required,
        estimated_duration=payload.estimated_duration,
        max_retries=min(payload.max_retries, settings.max_task_retries),
        status=TaskStatus.PENDING,
        created_at=utcnow(),
    )
    session.add(task)
    await session.flush()

    transition(task, TaskStatus.QUEUED)
    task.queued_at = utcnow()
    await queue_manager.enqueue(task)

    await events.emit(
        session,
        events.TASK_CREATED,
        component="api",
        task_id=task.task_id,
        message=f"Task {task.name} submitted ({task.priority.value})",
        data={"priority": task.priority.value, "cpu": task.cpu_required},
    )
    return task


async def list_tasks(
    session: AsyncSession,
    *,
    status: str | None = None,
    search: str | None = None,
    limit: int = 200,
) -> list[Task]:
    stmt = select(Task).order_by(desc(Task.created_at)).limit(min(limit, 500))
    if status:
        stmt = stmt.where(Task.status == TaskStatus(status.upper()))
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            func.lower(Task.name).like(pattern) | func.lower(Task.task_id).like(pattern)
        )
    return list((await session.execute(stmt)).scalars())


async def get_task(session: AsyncSession, task_id: str) -> Task:
    task = (
        await session.execute(select(Task).where(Task.task_id == task_id))
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def list_attempts(session: AsyncSession, task_id: str) -> list[TaskAttempt]:
    stmt = select(TaskAttempt).where(TaskAttempt.task_id == task_id).order_by(TaskAttempt.id)
    return list((await session.execute(stmt)).scalars())


async def _current_attempt(session: AsyncSession, task: Task) -> TaskAttempt | None:
    stmt = (
        select(TaskAttempt)
        .where(TaskAttempt.task_id == task.task_id)
        .order_by(desc(TaskAttempt.id))
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def _worker(session: AsyncSession, worker_id: str | None) -> Worker | None:
    if not worker_id:
        return None
    return (
        await session.execute(select(Worker).where(Worker.worker_id == worker_id))
    ).scalar_one_or_none()


async def start_task(session: AsyncSession, task_id: str, worker_id: str) -> Task:
    task = await get_task(session, task_id)
    if task.assigned_worker_id != worker_id:
        raise HTTPException(status_code=409, detail="Task is not assigned to this worker")
    transition(task, TaskStatus.RUNNING)
    task.started_at = utcnow()
    attempt = await _current_attempt(session, task)
    if attempt:
        attempt.status = "RUNNING"
        attempt.started_at = utcnow()
    await events.emit(
        session,
        events.TASK_STARTED,
        component="worker",
        worker_id=worker_id,
        task_id=task.task_id,
        message=f"{worker_id} started {task.task_id}",
    )
    return task


async def complete_task(
    session: AsyncSession, task_id: str, worker_id: str, result: str | None = None
) -> Task:
    task = await get_task(session, task_id)
    transition(task, TaskStatus.COMPLETED)
    task.completed_at = utcnow()
    task.result = result
    task.actual_duration = round(seconds_since(task.started_at), 2) if task.started_at else None

    attempt = await _current_attempt(session, task)
    if attempt:
        attempt.status = "COMPLETED"
        attempt.completed_at = utcnow()
        attempt.execution_time = task.actual_duration

    worker = await _worker(session, worker_id)
    if worker:
        release(worker, task)
        worker.total_tasks_completed += 1
        worker.reliability_score = min(100.0, worker.reliability_score + 0.2)

    await events.emit(
        session,
        events.TASK_COMPLETED,
        component="worker",
        worker_id=worker_id,
        task_id=task.task_id,
        message=f"{task.task_id} completed in {task.actual_duration}s",
        data={"duration": task.actual_duration},
    )
    return task


async def fail_task(
    session: AsyncSession, task_id: str, worker_id: str, error_message: str
) -> Task:
    """Mark a task failed and requeue it when retries remain."""
    task = await get_task(session, task_id)
    transition(task, TaskStatus.FAILED)
    task.failed_at = utcnow()
    task.error_message = error_message[:2000]

    attempt = await _current_attempt(session, task)
    if attempt:
        attempt.status = "FAILED"
        attempt.completed_at = utcnow()
        attempt.error_message = error_message[:2000]
        attempt.execution_time = round(seconds_since(attempt.started_at), 2)

    worker = await _worker(session, worker_id)
    if worker:
        release(worker, task)
        worker.total_tasks_failed += 1
        worker.reliability_score = max(0.0, worker.reliability_score - 2)

    await events.emit(
        session,
        events.TASK_FAILED,
        component="worker",
        level="ERROR",
        worker_id=worker_id,
        task_id=task.task_id,
        message=f"{task.task_id} failed: {error_message}",
    )
    await maybe_retry(session, task, reason="execution failure")
    return task


async def maybe_retry(session: AsyncSession, task: Task, *, reason: str) -> bool:
    """Requeue the task when retries remain. Returns True when retried."""
    if task.retry_count >= task.max_retries:
        return False
    task.retry_count += 1
    transition(task, TaskStatus.RETRYING)
    task.assigned_worker_id = None
    task.started_at = None
    transition(task, TaskStatus.QUEUED)
    task.queued_at = utcnow()
    await queue_manager.enqueue(task)
    await events.emit(
        session,
        events.TASK_RETRYING,
        component="recovery",
        level="WARNING",
        task_id=task.task_id,
        message=f"{task.task_id} retry {task.retry_count}/{task.max_retries} ({reason})",
        data={"retry_count": task.retry_count, "reason": reason},
    )
    return True


async def cancel_task(session: AsyncSession, task_id: str) -> Task:
    task = await get_task(session, task_id)
    transition(task, TaskStatus.CANCELLED)
    await queue_manager.remove(task.task_id)
    worker = await _worker(session, task.assigned_worker_id)
    if worker:
        release(worker, task)
    await events.emit(
        session,
        events.TASK_CANCELLED,
        component="api",
        level="WARNING",
        task_id=task.task_id,
        message=f"{task.task_id} cancelled",
    )
    return task


async def retry_task(session: AsyncSession, task_id: str) -> Task:
    """Manual retry from the UI."""
    task = await get_task(session, task_id)
    if task.status not in (TaskStatus.FAILED, TaskStatus.CANCELLED):
        raise HTTPException(status_code=409, detail="Only failed or cancelled tasks can be retried")
    task.status = TaskStatus.FAILED
    task.max_retries = max(task.max_retries, task.retry_count + 1)
    await maybe_retry(session, task, reason="manual retry")
    return task


async def assignments_for_worker(session: AsyncSession, worker_id: str) -> list[Task]:
    stmt = select(Task).where(
        Task.assigned_worker_id == worker_id, Task.status == TaskStatus.SCHEDULED
    )
    return list((await session.execute(stmt)).scalars())
