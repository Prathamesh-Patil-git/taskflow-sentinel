from __future__ import annotations

from app.models.task import Task, TaskPriority, TaskStatus
from app.models.worker import Worker, WorkerStatus
from app.scheduler.engine import scheduler_engine
from app.scheduler.strategies import (
    LeastLoadedStrategy,
    PriorityBasedStrategy,
    ResourceAwareStrategy,
    RoundRobinStrategy,
)
from app.schemas.task import TaskCreate
from app.services import scheduler_service, task_service
from app.utils.time import utcnow


def make_worker(worker_id: str, cpu_usage=0.0, active=0, reliability=100.0) -> Worker:
    return Worker(
        worker_id=worker_id,
        hostname=worker_id,
        status=WorkerStatus.ONLINE,
        cpu_capacity=8,
        cpu_usage=cpu_usage,
        memory_capacity=16384,
        memory_usage=0,
        active_tasks=active,
        reliability_score=reliability,
        last_heartbeat=utcnow(),
    )


def make_task(cpu=1.0, memory=512.0, priority=TaskPriority.MEDIUM) -> Task:
    return Task(
        task_id="T-1",
        name="t",
        priority=priority,
        status=TaskStatus.QUEUED,
        cpu_required=cpu,
        memory_required=memory,
    )


def test_round_robin_cycles():
    strategy = RoundRobinStrategy()
    workers = [make_worker("worker-01"), make_worker("worker-02")]
    first, _ = strategy.select_worker(make_task(), workers)
    second, _ = strategy.select_worker(make_task(), workers)
    assert {first.worker_id, second.worker_id} == {"worker-01", "worker-02"}


def test_least_loaded_prefers_idle_worker():
    strategy = LeastLoadedStrategy()
    workers = [make_worker("worker-01", cpu_usage=6, active=5), make_worker("worker-02")]
    winner, _ = strategy.select_worker(make_task(), workers)
    assert winner.worker_id == "worker-02"


def test_resource_aware_rejects_insufficient_capacity():
    strategy = ResourceAwareStrategy()
    workers = [make_worker("worker-01", cpu_usage=7.5)]
    winner, scores = strategy.select_worker(make_task(cpu=4), workers)
    assert winner is None and scores == []


def test_resource_aware_scores_are_normalised():
    strategy = ResourceAwareStrategy()
    workers = [make_worker("worker-01"), make_worker("worker-02", cpu_usage=4, reliability=70)]
    winner, scores = strategy.select_worker(make_task(), workers)
    assert winner.worker_id == "worker-01"
    assert all(0 <= s.score <= 1 for s in scores)


def test_priority_strategy_favours_reliable_worker_for_critical_task():
    strategy = PriorityBasedStrategy()
    workers = [make_worker("worker-01", reliability=99), make_worker("worker-02", reliability=40)]
    winner, _ = strategy.select_worker(make_task(priority=TaskPriority.CRITICAL), workers)
    assert winner.worker_id == "worker-01"


async def test_engine_assigns_queued_task(session, workers):
    task = await task_service.create_task(session, TaskCreate(name="Model Training", cpu_required=2))
    await session.commit()

    assigned = await scheduler_engine.tick(session, batch=5)
    await session.commit()
    await session.refresh(task)

    assert assigned == 1
    assert task.status is TaskStatus.SCHEDULED
    assert task.assigned_worker_id in {w.worker_id for w in workers}


async def test_scheduler_state_and_algorithm_switch(session, workers):
    await task_service.create_task(session, TaskCreate(name="A"))
    await session.commit()
    await scheduler_engine.tick(session)
    await session.commit()

    state = await scheduler_service.state(session)
    assert state["tasks_scheduled"] >= 1
    assert state["decisions"]

    updated = await scheduler_service.set_algorithm(session, "LEAST_LOADED")
    assert updated["algorithm"] == "LEAST_LOADED"


async def test_priority_task_scheduled_before_low_priority(session, workers):
    low = await task_service.create_task(session, TaskCreate(name="low", priority="LOW"))
    high = await task_service.create_task(session, TaskCreate(name="high", priority="CRITICAL"))
    await session.commit()

    await scheduler_engine.tick(session, batch=1)
    await session.commit()
    await session.refresh(high)
    await session.refresh(low)
    assert high.status is TaskStatus.SCHEDULED
    assert low.status is TaskStatus.QUEUED
