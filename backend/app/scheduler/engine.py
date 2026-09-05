"""The scheduling engine: pulls from the priority queue and assigns workers."""
from __future__ import annotations

import asyncio
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import get_logger
from app.core.redis import redis_gateway
from app.models.scheduler import SchedulerConfig
from app.models.task import Task, TaskStatus, can_transition
from app.models.task_attempt import TaskAttempt
from app.models.worker import Worker
from app.scheduler.queue_manager import queue_manager, queue_score
from app.scheduler.resource_manager import reserve
from app.scheduler.strategies import get_strategy
from app.utils.time import seconds_since, utcnow
from app.websocket import events

log = get_logger("scheduler")


async def get_config(session: AsyncSession) -> SchedulerConfig:
    config = (await session.execute(select(SchedulerConfig).limit(1))).scalar_one_or_none()
    if config is None:
        config = SchedulerConfig(algorithm=settings.default_scheduling_algorithm)
        session.add(config)
        await session.flush()
    return config


class SchedulerEngine:
    """Runs as an asyncio background task inside the FastAPI process."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._running = False
        self.last_tick: datetime | None = None
        self.scheduled_since_start = 0
        self.latencies: list[float] = []

    # ---- lifecycle -------------------------------------------------------
    async def start(self) -> None:
        if self._task is None:
            self._running = True
            self._task = asyncio.create_task(self._loop(), name="scheduler-engine")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None

    @property
    def healthy(self) -> bool:
        return self._running and self._task is not None and not self._task.done()

    async def _loop(self) -> None:
        while self._running:
            try:
                async with SessionLocal() as session:
                    await self.tick(session)
                    await session.commit()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # pragma: no cover - defensive
                log.warning(f"scheduler tick failed: {exc}")
            self.last_tick = utcnow()
            await asyncio.sleep(settings.scheduler_tick)

    # ---- scheduling ------------------------------------------------------
    async def tick(self, session: AsyncSession, batch: int = 5) -> int:
        task_ids = await queue_manager.dequeue_batch(batch)
        if not task_ids:
            return 0
        assigned = 0
        for task_id in task_ids:
            if await self.schedule_task(session, task_id):
                assigned += 1
        return assigned

    async def schedule_task(self, session: AsyncSession, task_id: str) -> bool:
        """Assign one queued task. Returns True when a worker was selected."""
        if not await redis_gateway.acquire_task_lock(task_id):
            return False
        try:
            task = (
                await session.execute(select(Task).where(Task.task_id == task_id))
            ).scalar_one_or_none()
            if task is None or task.status not in (TaskStatus.QUEUED, TaskStatus.RETRYING):
                return False
            if task.status is TaskStatus.RETRYING:
                task.status = TaskStatus.QUEUED
                task.queued_at = task.queued_at or utcnow()

            workers = list((await session.execute(select(Worker))).scalars())
            config = await get_config(session)
            strategy = get_strategy(config.algorithm)
            worker, scores = strategy.select_worker(task, workers)

            score_payload = [{"worker_id": s.worker_id, "score": s.score} for s in scores]

            if worker is None:
                config.rejected_assignments += 1
                await queue_manager.requeue_raw(task.task_id, queue_score(task))
                await events.emit(
                    session,
                    events.SCHEDULER_DECISION,
                    component="scheduler",
                    level="WARNING",
                    task_id=task.task_id,
                    message=f"No eligible worker for {task.task_id}; task requeued",
                    data={
                        "scores": score_payload,
                        "selected_worker_id": None,
                        "algorithm": config.algorithm,
                        "task_name": task.name,
                        "cpu_required": task.cpu_required,
                        "memory_required": task.memory_required,
                    },
                )
                return False

            if not can_transition(task.status, TaskStatus.SCHEDULED):
                return False

            latency = seconds_since(task.queued_at)
            if latency == float("inf"):
                latency = 0.0
            self.latencies = (self.latencies + [latency])[-200:]

            task.status = TaskStatus.SCHEDULED
            task.assigned_worker_id = worker.worker_id
            task.scheduled_at = utcnow()
            reserve(worker, task)

            session.add(
                TaskAttempt(
                    task_id=task.task_id,
                    worker_id=worker.worker_id,
                    attempt_number=task.retry_count + 1,
                    status="SCHEDULED",
                )
            )

            config.tasks_scheduled += 1
            config.successful_assignments += 1
            config.total_scheduling_latency += latency
            self.scheduled_since_start += 1

            await events.emit(
                session,
                events.SCHEDULER_DECISION,
                component="scheduler",
                worker_id=worker.worker_id,
                task_id=task.task_id,
                message=f"{task.task_id} assigned to {worker.worker_id} ({config.algorithm})",
                data={
                    "scores": score_payload,
                    "selected_worker_id": worker.worker_id,
                    "algorithm": config.algorithm,
                    "task_name": task.name,
                    "cpu_required": task.cpu_required,
                    "memory_required": task.memory_required,
                    "latency": round(latency, 3),
                },
            )
            await events.emit(
                session,
                events.TASK_ASSIGNED,
                component="scheduler",
                worker_id=worker.worker_id,
                task_id=task.task_id,
                message=f"Task {task.name} assigned to {worker.worker_id}",
                persist=False,
            )
            return True
        finally:
            await redis_gateway.release_task_lock(task_id)


scheduler_engine = SchedulerEngine()
