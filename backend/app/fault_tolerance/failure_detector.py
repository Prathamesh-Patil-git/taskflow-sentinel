"""Background detector: heartbeat timeout -> fault -> automatic task recovery."""
from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import get_logger
from app.fault_tolerance.heartbeat import is_stale
from app.models.fault import FaultSeverity, FaultType
from app.models.worker import Worker, WorkerStatus
from app.services import fault_service, recovery_service

log = get_logger("failure-detector")


class FailureDetector:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._task is None:
            self._running = True
            self._task = asyncio.create_task(self._loop(), name="failure-detector")

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
                    await self.scan(session)
                    await session.commit()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # pragma: no cover
                log.warning(f"failure detector error: {exc}")
            await asyncio.sleep(settings.detector_tick)

    async def scan(self, session: AsyncSession) -> list[str]:
        """Mark stale workers FAILED and recover their tasks. Returns worker ids."""
        stmt = select(Worker).where(
            Worker.status.notin_([WorkerStatus.FAILED, WorkerStatus.OFFLINE])
        )
        detected: list[str] = []
        for worker in (await session.execute(stmt)).scalars():
            if not is_stale(worker):
                continue
            fault = await fault_service.create_fault(
                session,
                worker_id=worker.worker_id,
                fault_type=FaultType.HEARTBEAT_TIMEOUT,
                severity=FaultSeverity.CRITICAL,
                description=(
                    f"No heartbeat from {worker.worker_id} for more than "
                    f"{settings.failure_timeout}s"
                ),
            )
            await recovery_service.recover_worker_tasks(session, worker, fault)
            detected.append(worker.worker_id)
        return detected


failure_detector = FailureDetector()
