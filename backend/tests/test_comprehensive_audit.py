"""End-to-end integration and audit tests covering the complete TaskFlow Sentinel workflow."""
from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.models.fault import FaultSeverity, FaultStatus, FaultType
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.task_attempt import TaskAttempt
from app.models.worker import Worker, WorkerStatus
from app.scheduler.engine import scheduler_engine
from app.schemas.task import TaskCreate
from app.schemas.worker import HeartbeatIn
from app.services import (
    fault_service,
    recovery_service,
    resource_service,
    scheduler_service,
    task_service,
    worker_service,
)
from app.utils.time import utcnow
from app.websocket.manager import ws_manager


async def test_full_scheduling_algorithms_audit(session, workers):
    """Test switching through all four scheduling algorithms and verifying their decisions."""
    algorithms = ["RESOURCE_AWARE", "ROUND_ROBIN", "LEAST_LOADED", "PRIORITY_BASED"]

    for algo in algorithms:
        await scheduler_service.set_algorithm(session, algo)
        task = await task_service.create_task(
            session,
            TaskCreate(
                name=f"audit-task-{algo}",
                priority="HIGH",
                cpu_required=1.0,
                memory_required=512.0,
            ),
        )
        await session.commit()

        assigned_count = await scheduler_engine.tick(session, batch=1)
        await session.commit()
        await session.refresh(task)

        assert assigned_count == 1
        assert task.status is TaskStatus.SCHEDULED
        assert task.assigned_worker_id in {w.worker_id for w in workers}

    state = await scheduler_service.state(session)
    assert state["tasks_scheduled"] >= 4
    assert len(state["decisions"]) >= 4


async def test_task_full_execution_lifecycle(session, workers):
    """Verify task lifecycle from QUEUED -> SCHEDULED -> RUNNING -> COMPLETED with attempt tracking."""
    task = await task_service.create_task(
        session,
        TaskCreate(
            name="ML Inference",
            priority="CRITICAL",
            cpu_required=2.0,
            memory_required=1024.0,
            task_type="CPU_TASK",
        ),
    )
    await session.commit()
    assert task.status is TaskStatus.QUEUED

    # 1. Schedule
    await scheduler_engine.tick(session, batch=1)
    await session.commit()
    await session.refresh(task)
    assert task.status is TaskStatus.SCHEDULED
    worker_id = task.assigned_worker_id
    assert worker_id is not None

    # Verify attempt created
    attempts = await task_service.list_attempts(session, task.task_id)
    assert len(attempts) == 1
    assert attempts[0].status == "SCHEDULED"

    # 2. Start
    started = await task_service.start_task(session, task.task_id, worker_id)
    await session.commit()
    assert started.status is TaskStatus.RUNNING
    assert started.started_at is not None

    # 3. Complete
    completed = await task_service.complete_task(
        session, task.task_id, worker_id, result="Inference finished in 0.42s"
    )
    await session.commit()
    assert completed.status is TaskStatus.COMPLETED
    assert completed.completed_at is not None
    assert completed.actual_duration is not None

    # Verify attempt status updated
    attempts = await task_service.list_attempts(session, task.task_id)
    assert len(attempts) == 1
    assert attempts[0].status == "COMPLETED"


async def test_failure_detection_and_automated_recovery(session, workers):
    """Simulate a worker crash with active tasks, verify failure detector, fault creation, and reassignment."""
    worker_victim = workers[0]

    # Create task assigned to victim
    task = await task_service.create_task(
        session,
        TaskCreate(name="Critical DB Backup", priority="CRITICAL", cpu_required=1.0, memory_required=256.0),
    )
    await session.commit()
    await scheduler_engine.tick(session, batch=1)
    await session.commit()
    await session.refresh(task)

    # Force assignment to victim and start
    task.assigned_worker_id = worker_victim.worker_id
    await task_service.start_task(session, task.task_id, worker_victim.worker_id)
    await session.commit()

    # Victim stops heartbeating (simulate silent node crash)
    worker_victim.last_heartbeat = utcnow() - timedelta(seconds=15)
    await session.commit()

    from app.fault_tolerance.failure_detector import failure_detector

    detected = await failure_detector.scan(session)
    await session.commit()

    assert worker_victim.worker_id in detected
    await session.refresh(worker_victim)
    assert worker_victim.status is WorkerStatus.FAILED

    # Task should now be recovered and requeued
    await session.refresh(task)
    assert task.status is TaskStatus.QUEUED
    assert task.retry_count == 1
    assert task.assigned_worker_id is None

    # Scheduler should reassign task to survivor
    await scheduler_engine.tick(session, batch=1)
    await session.commit()
    await session.refresh(task)

    assert task.status is TaskStatus.SCHEDULED
    assert task.assigned_worker_id != worker_victim.worker_id

    # Finish on survivor
    await task_service.start_task(session, task.task_id, task.assigned_worker_id)
    await task_service.complete_task(session, task.task_id, task.assigned_worker_id, "Recovered ok")
    await session.commit()
    await session.refresh(task)
    assert task.status is TaskStatus.COMPLETED


async def test_analytics_and_monitoring_endpoints(client, workers):
    """Verify all analytics, metrics and health REST endpoints respond with correct schemas."""
    # 1. System health
    health_resp = await client.get("/health")
    assert health_resp.status_code == 200
    health_data = health_resp.json()
    assert health_data["status"] in ("healthy", "degraded")
    assert health_data["database"] == "healthy"
    assert "redis" in health_data
    assert "scheduler" in health_data

    # 2. Analytics overview
    overview_resp = await client.get("/api/analytics/overview")
    assert overview_resp.status_code == 200
    overview_data = overview_resp.json()
    assert "total_tasks" in overview_data
    assert "cpu_utilization" in overview_data

    # 3. Algorithm comparison
    algo_resp = await client.get("/api/analytics/scheduling")
    assert algo_resp.status_code == 200
    algo_data = algo_resp.json()
    assert isinstance(algo_data, list)

    # 4. Resources
    res_resp = await client.get("/api/analytics/resources")
    assert res_resp.status_code == 200

    # 5. Dashboard summary
    dash_resp = await client.get("/api/dashboard")
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert "active_workers" in dash_data
    assert "series" in dash_data
