"""Demo data seeder:  python -m app.seed"""
from __future__ import annotations

import asyncio
import random
from datetime import timedelta

from sqlalchemy import delete

from app.core.database import SessionLocal, init_models
from app.core.redis import redis_gateway
from app.models.fault import Fault, FaultSeverity, FaultStatus, FaultType
from app.models.scheduler import SchedulerConfig
from app.models.system_event import SystemEvent
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.task_attempt import TaskAttempt
from app.models.worker import Worker, WorkerStatus
from app.utils.time import utcnow

TASK_NAMES = [
    "Image Processing", "ETL Ingest", "Model Training", "Report Rendering",
    "Log Compaction", "Video Transcode", "Index Rebuild", "Fraud Scoring",
    "Payment Reconcile", "Backup Snapshot", "Embedding Batch", "Cache Warmup",
]
TASK_TYPES = ["CPU_TASK", "MEMORY_TASK", "SLEEP_TASK", "FAILURE_TASK", "RANDOM_TASK"]


async def seed(
    worker_count: int = 8, task_count: int = 60, history_only: bool = False
) -> None:
    """Seed the database.

    ``history_only=True`` (used by the Docker entrypoint) inserts *only*
    historical, finished records: no worker rows, no running tasks, no fake
    heartbeats. Live cluster state always comes from real worker containers.
    """
    await init_models()
    await redis_gateway.connect()
    random.seed(7)

    async with SessionLocal() as session:
        for model in (TaskAttempt, Task, Fault, SystemEvent, Worker, SchedulerConfig):
            await session.execute(delete(model))

        session.add(SchedulerConfig(algorithm="RESOURCE_AWARE", tasks_scheduled=0))

        workers: list[Worker] = []
        for index in range(1, (0 if history_only else worker_count) + 1):
            worker_id = f"worker-{index:02d}"
            status = WorkerStatus.ONLINE if index != worker_count else WorkerStatus.OFFLINE
            worker = Worker(
                worker_id=worker_id,
                hostname=f"node-{index:02d}.cluster.local",
                region=random.choice(["eu-west", "us-east", "ap-south"]),
                status=status,
                cpu_capacity=random.choice([8, 16, 32]),
                memory_capacity=random.choice([16384, 32768, 65536]),
                reliability_score=round(random.uniform(92, 99.8), 1),
                uptime_seconds=random.randint(3600, 720000),
                last_heartbeat=utcnow(),
                registered_at=utcnow() - timedelta(days=random.randint(1, 40)),
            )
            workers.append(worker)
            session.add(worker)
        await session.flush()

        worker_ids = (
            [f"worker-{i:02d}" for i in range(1, 5)]
            if history_only
            else [w.worker_id for w in workers[:-1]]
        )

        now = utcnow()
        for index in range(task_count):
            created = now - timedelta(minutes=random.randint(1, 720))
            priority = random.choices(
                list(TaskPriority), weights=[10, 25, 45, 20], k=1
            )[0]
            worker_id = random.choice(worker_ids)
            roll = random.random() * (0.86 if history_only else 1.0)
            if roll < 0.65:
                status = TaskStatus.COMPLETED
            elif roll < 0.78:
                status = TaskStatus.RUNNING
            elif roll < 0.86:
                status = TaskStatus.FAILED
            elif roll < 0.93:
                status = TaskStatus.QUEUED
            else:
                status = TaskStatus.RETRYING

            duration = round(random.uniform(2, 90), 2)
            task = Task(
                task_id=f"T-{1000 + index}",
                name=random.choice(TASK_NAMES),
                description="Seeded demo workload",
                task_type=random.choice(TASK_TYPES),
                priority=priority,
                status=status,
                cpu_required=random.choice([1, 2, 4]),
                memory_required=random.choice([256, 512, 1024, 2048]),
                estimated_duration=round(random.uniform(5, 60), 1),
                retry_count=1 if status is TaskStatus.RETRYING else 0,
                max_retries=3,
                created_at=created,
                queued_at=created + timedelta(seconds=1),
                scheduled_at=created + timedelta(seconds=random.randint(1, 4)),
            )
            if status in (TaskStatus.RUNNING, TaskStatus.COMPLETED, TaskStatus.FAILED):
                task.assigned_worker_id = worker.worker_id
                task.started_at = created + timedelta(seconds=random.randint(2, 8))
            if status is TaskStatus.COMPLETED:
                task.completed_at = task.started_at + timedelta(seconds=duration)
                task.actual_duration = duration
                task.result = "ok"
                worker.total_tasks_completed += 1
            if status is TaskStatus.FAILED:
                task.failed_at = task.started_at + timedelta(seconds=duration / 2)
                task.error_message = "worker reported execution error"
                worker.total_tasks_failed += 1
            if status is TaskStatus.RUNNING:
                worker.active_tasks += 1
                worker.cpu_usage = min(worker.cpu_capacity, worker.cpu_usage + task.cpu_required)
                worker.memory_usage = min(
                    worker.memory_capacity, worker.memory_usage + task.memory_required
                )
                worker.status = WorkerStatus.BUSY
            session.add(task)

            session.add(
                TaskAttempt(
                    task_id=task.task_id,
                    worker_id=task.assigned_worker_id,
                    attempt_number=task.retry_count + 1,
                    status=status.value,
                    started_at=task.started_at or created,
                    completed_at=task.completed_at,
                    execution_time=task.actual_duration,
                )
            )

            if status in (TaskStatus.QUEUED, TaskStatus.RETRYING):
                await redis_gateway.enqueue(task.task_id, TaskPriority(priority).weight)

            session.add(
                SystemEvent(
                    event_type="SCHEDULER_DECISION",
                    component="scheduler",
                    level="INFO",
                    worker_id=worker.worker_id,
                    task_id=task.task_id,
                    message=f"{task.task_id} assigned to {worker.worker_id} (RESOURCE_AWARE)",
                    event_metadata={
                        "algorithm": random.choice(
                            ["RESOURCE_AWARE", "LEAST_LOADED", "ROUND_ROBIN", "PRIORITY_BASED"]
                        ),
                        "task_name": task.name,
                        "cpu_required": task.cpu_required,
                        "memory_required": task.memory_required,
                        "selected_worker_id": worker.worker_id,
                        "latency": round(random.uniform(0.05, 1.4), 3),
                        "scores": [
                            {"worker_id": w.worker_id, "score": round(random.uniform(0.4, 0.97), 2)}
                            for w in random.sample(workers[:-1], 3)
                        ],
                    },
                    created_at=created,
                )
            )

        for index in range(4):
            detected = now - timedelta(hours=random.randint(1, 20))
            recovery = round(random.uniform(1.5, 9.5), 2)
            session.add(
                Fault(
                    fault_id=f"F-SEED{index:03d}",
                    worker_id=random.choice(worker_ids),
                    fault_type=random.choice(list(FaultType)),
                    severity=random.choice([FaultSeverity.ERROR, FaultSeverity.CRITICAL]),
                    status=FaultStatus.RECOVERED,
                    detected_at=detected,
                    recovered_at=detected + timedelta(seconds=recovery),
                    affected_tasks=random.randint(1, 5),
                    recovery_time=recovery,
                    description="Historic fault recovered automatically",
                )
            )

        for level, message in [
            ("INFO", "Cluster bootstrap complete"),
            ("INFO", "Scheduler engine online (RESOURCE_AWARE)"),
            ("WARNING", "Queue depth above soft threshold"),
            ("ERROR", "worker-06 heartbeat delayed"),
        ]:
            session.add(
                SystemEvent(
                    event_type="SYSTEM",
                    component="system",
                    level=level,
                    message=message,
                    created_at=now - timedelta(minutes=random.randint(1, 300)),
                )
            )

        await session.commit()
    print(f"Seeded {worker_count} workers and {task_count} tasks.")


if __name__ == "__main__":
    asyncio.run(seed())
