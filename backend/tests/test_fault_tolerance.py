"""The core fault-tolerance scenario: worker failure -> task recovery."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select

from app.models.fault import FaultStatus
from app.models.task import Task, TaskStatus
from app.models.task_attempt import TaskAttempt
from app.models.worker import WorkerStatus
from app.scheduler.engine import scheduler_engine
from app.schemas.task import TaskCreate
from app.services import fault_service, task_service, worker_service
from app.utils.time import utcnow


async def test_simulated_failure_recovers_running_tasks(session, workers):
    # 1. submit 10 tasks and let the scheduler assign them
    for index in range(10):
        await task_service.create_task(
            session, TaskCreate(name=f"job-{index}", cpu_required=1, memory_required=256)
        )
    await session.commit()
    await scheduler_engine.tick(session, batch=10)
    await session.commit()

    # 2. force every task onto worker-02 and start it there
    tasks = list((await session.execute(select(Task))).scalars())
    victim = "worker-02"
    for task in tasks:
        task.assigned_worker_id = victim
        task.status = TaskStatus.SCHEDULED
        attempt = (
            await session.execute(
                select(TaskAttempt).where(TaskAttempt.task_id == task.task_id)
            )
        ).scalars().first()
        if attempt:
            attempt.worker_id = victim
        await task_service.start_task(session, task.task_id, victim)
    await session.commit()
    assert all(t.status is TaskStatus.RUNNING for t in tasks)

    # 3. simulate the crash
    result = await fault_service.simulate_failure(session, victim, immediate=True)
    await session.commit()

    assert result["affected_tasks"] == 10
    assert len(result["requeued"]) == 10
    assert result["recovery_time"] is not None

    worker = await worker_service.get_worker(session, victim)
    assert worker.status is WorkerStatus.FAILED

    # 4. every task is retried and requeued, retry count incremented, no loss
    for task in tasks:
        await session.refresh(task)
        assert task.status is TaskStatus.QUEUED
        assert task.retry_count == 1
        assert task.assigned_worker_id is None

    # 5. the scheduler reassigns them to the surviving workers
    await scheduler_engine.tick(session, batch=10)
    await session.commit()
    for task in tasks:
        await session.refresh(task)
    reassigned = [t for t in tasks if t.status is TaskStatus.SCHEDULED]
    assert reassigned, "tasks must be reassigned after recovery"
    assert all(t.assigned_worker_id != victim for t in reassigned)

    # 6. completing them yields exactly one successful attempt per task
    for task in reassigned:
        await task_service.start_task(session, task.task_id, task.assigned_worker_id)
        await task_service.complete_task(session, task.task_id, task.assigned_worker_id, "ok")
    await session.commit()

    for task in reassigned:
        await session.refresh(task)
        assert task.status is TaskStatus.COMPLETED
        attempts = await task_service.list_attempts(session, task.task_id)
        assert len([a for a in attempts if a.status == "COMPLETED"]) == 1

    summary = await fault_service.fault_summary(session)
    assert summary["failures_today"] >= 1
    assert summary["average_recovery_time"] >= 0


async def test_retry_limit_is_respected(session, workers):
    task = await task_service.create_task(session, TaskCreate(name="flaky", max_retries=1))
    await session.commit()
    await scheduler_engine.tick(session)
    await session.commit()
    await session.refresh(task)

    worker_id = task.assigned_worker_id
    await task_service.start_task(session, task.task_id, worker_id)
    await task_service.fail_task(session, task.task_id, worker_id, "boom")
    await session.commit()
    assert task.retry_count == 1 and task.status is TaskStatus.QUEUED

    await scheduler_engine.tick(session)
    await session.commit()
    await session.refresh(task)
    await task_service.start_task(session, task.task_id, task.assigned_worker_id)
    await task_service.fail_task(session, task.task_id, task.assigned_worker_id, "boom again")
    await session.commit()
    assert task.status is TaskStatus.FAILED
    assert task.retry_count == 1


async def test_no_duplicate_execution_under_lock(session, workers):
    task = await task_service.create_task(session, TaskCreate(name="single"))
    await session.commit()
    await scheduler_engine.tick(session)
    await session.commit()
    await session.refresh(task)
    assert task.status is TaskStatus.SCHEDULED

    # a second scheduling pass must not reassign an already scheduled task
    before = task.assigned_worker_id
    await scheduler_engine.schedule_task(session, task.task_id)
    await session.commit()
    await session.refresh(task)
    assert task.assigned_worker_id == before


async def test_heartbeat_timeout_creates_fault_and_recovers(session, workers):
    task = await task_service.create_task(session, TaskCreate(name="stranded"))
    await session.commit()
    await scheduler_engine.tick(session)
    await session.commit()
    await session.refresh(task)

    victim = task.assigned_worker_id
    await task_service.start_task(session, task.task_id, victim)
    worker = await worker_service.get_worker(session, victim)
    worker.last_heartbeat = utcnow() - timedelta(seconds=300)
    await session.commit()

    from app.fault_tolerance.failure_detector import failure_detector

    await failure_detector.scan(session)
    await session.commit()
    await session.refresh(task)

    faults = await fault_service.list_faults(session)
    assert faults and faults[0].status is FaultStatus.RECOVERED
    assert task.status is TaskStatus.QUEUED and task.retry_count == 1


async def test_detector_mode_simulation_stops_heartbeat_only(session, workers):
    """Default simulate-failure mode must not fake the DB status: it stops the
    real worker runtime so the heartbeat timeout drives the detection."""
    result = await fault_service.simulate_failure(session, "worker-01")
    await session.commit()

    assert result["mode"] == "detector"
    worker = await worker_service.get_worker(session, "worker-01")
    assert worker.status is not WorkerStatus.FAILED
    assert await worker_service.is_paused("worker-01") is True

    # the failure detector observes the stale heartbeat and marks it FAILED
    from app.fault_tolerance.failure_detector import failure_detector

    worker.last_heartbeat = utcnow() - timedelta(seconds=120)
    await session.commit()
    await failure_detector.scan(session)
    await session.commit()

    await session.refresh(worker)
    assert worker.status is WorkerStatus.FAILED

    await worker_service.recover_worker(session, "worker-01")
    await session.commit()
    assert await worker_service.is_paused("worker-01") is False
