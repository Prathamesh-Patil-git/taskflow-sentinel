"""Priority-aware Redis queue with aging so low priority tasks never starve."""
from __future__ import annotations

from app.core.redis import redis_gateway
from app.models.task import Task, TaskPriority
from app.utils.time import seconds_since, utcnow

#: One point of extra score per this many seconds spent waiting.
AGING_SECONDS = 5.0
AGING_CAP = 60.0


def queue_score(task: Task) -> float:
    base = TaskPriority(task.priority).weight
    waited = seconds_since(task.queued_at or task.created_at or utcnow())
    if waited == float("inf"):
        waited = 0.0
    aging = min(AGING_CAP, waited / AGING_SECONDS)
    return round(base + aging, 4)


class QueueManager:
    async def enqueue(self, task: Task) -> None:
        await redis_gateway.enqueue(task.task_id, queue_score(task))

    async def dequeue_batch(self, count: int = 5) -> list[str]:
        return await redis_gateway.dequeue(count)

    async def remove(self, task_id: str) -> None:
        await redis_gateway.remove_from_queue(task_id)

    async def depth(self) -> int:
        return await redis_gateway.queue_depth()

    async def requeue_raw(self, task_id: str, score: float) -> None:
        await redis_gateway.enqueue(task_id, score)


queue_manager = QueueManager()
