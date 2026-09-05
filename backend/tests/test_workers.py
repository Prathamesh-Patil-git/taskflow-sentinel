from __future__ import annotations

from datetime import timedelta

from app.fault_tolerance.failure_detector import failure_detector
from app.models.worker import WorkerStatus
from app.schemas.worker import HeartbeatIn, WorkerRegisterIn
from app.services import resource_service, worker_service
from app.utils.time import utcnow


async def test_register_and_heartbeat(session):
    worker = await worker_service.register_worker(
        session, WorkerRegisterIn(worker_id="worker-09", cpu_capacity=8, memory_capacity=16384)
    )
    assert worker.status is WorkerStatus.ONLINE

    updated = await worker_service.heartbeat(
        session, "worker-09", HeartbeatIn(cpu_usage=4, memory_usage=8192, active_tasks=2)
    )
    assert updated.cpu_percent == 50.0
    assert updated.status is WorkerStatus.BUSY


async def test_failure_detector_marks_stale_worker_failed(session, workers):
    stale = workers[1]
    stale.last_heartbeat = utcnow() - timedelta(seconds=120)
    await session.commit()

    detected = await failure_detector.scan(session)
    await session.commit()

    assert stale.worker_id in detected
    await session.refresh(stale)
    assert stale.status is WorkerStatus.FAILED


async def test_resource_calculation(session, workers):
    await worker_service.heartbeat(
        session, workers[0].worker_id, HeartbeatIn(cpu_usage=4, memory_usage=8192, active_tasks=1)
    )
    await session.commit()
    util = await resource_service.cluster_utilisation(session)
    assert 0 < util["cpu_utilization"] < 100
    health = await resource_service.system_health(session)
    assert 0 <= health["overall"] <= 100


async def test_worker_api_endpoints(client, workers):
    listing = await client.get("/api/workers")
    assert listing.status_code == 200
    assert len(listing.json()) == 3

    detail = await client.get("/api/workers/worker-01")
    assert detail.status_code == 200

    health = await client.get("/health")
    assert health.status_code == 200
    assert "database" in health.json()

    dashboard = await client.get("/api/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["active_workers"] == 3
