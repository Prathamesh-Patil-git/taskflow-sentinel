"""Recovers tasks stranded on a failed worker (the core fault-tolerance path)."""
from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fault import Fault, FaultStatus
from app.models.task import Task, TaskStatus
from app.models.task_attempt import TaskAttempt
from app.models.worker import Worker, WorkerStatus
from app.services import task_service
from app.utils.time import seconds_since, utcnow
from app.websocket import events


async def recover_worker_tasks(session: AsyncSession, worker: Worker, fault: Fault) -> dict:
    """Fail the in-flight attempts of a dead worker and requeue their tasks."""
    stmt = select(Task).where(
        Task.assigned_worker_id == worker.worker_id,
        Task.status.in_([TaskStatus.RUNNING, TaskStatus.SCHEDULED]),
    )
    affected = list((await session.execute(stmt)).scalars())

    requeued: list[str] = []
    abandoned: list[str] = []

    for task in affected:
        attempt = (
            await session.execute(
                select(TaskAttempt)
                .where(TaskAttempt.task_id == task.task_id)
                .order_by(desc(TaskAttempt.id))
                .limit(1)
            )
        ).scalar_one_or_none()
        if attempt and attempt.status not in ("COMPLETED", "FAILED"):
            attempt.status = "FAILED"
            attempt.completed_at = utcnow()
            attempt.error_message = f"worker {worker.worker_id} failed"
            attempt.execution_time = round(seconds_since(attempt.started_at), 2)

        task.status = TaskStatus.FAILED
        task.failed_at = utcnow()
        task.error_message = f"Worker {worker.worker_id} failed mid-execution"

        if await task_service.maybe_retry(session, task, reason=f"{worker.worker_id} failure"):
            requeued.append(task.task_id)
        else:
            abandoned.append(task.task_id)

    fault.affected_tasks = len(affected)
    fault.status = FaultStatus.RECOVERED if not abandoned else FaultStatus.UNRESOLVED
    fault.recovered_at = utcnow()
    fault.recovery_time = round(seconds_since(fault.detected_at), 2)

    worker.cpu_usage = 0
    worker.memory_usage = 0
    worker.active_tasks = 0
    worker.status = WorkerStatus.FAILED

    await events.emit(
        session,
        events.WORKER_FAILED,
        component="recovery",
        level="CRITICAL" if abandoned else "ERROR",
        worker_id=worker.worker_id,
        message=(
            f"{worker.worker_id} failed — {len(affected)} task(s) detected, "
            f"{len(requeued)} requeued for reassignment"
        ),
        data={
            "fault_id": fault.fault_id,
            "affected_tasks": len(affected),
            "requeued": requeued,
            "abandoned": abandoned,
            "recovery_time": fault.recovery_time,
        },
    )
    return {
        "fault_id": fault.fault_id,
        "affected_tasks": len(affected),
        "requeued": requeued,
        "abandoned": abandoned,
        "recovery_time": fault.recovery_time,
    }
