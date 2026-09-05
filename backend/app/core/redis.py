"""Redis connection helpers: queue, worker cache, locks and pub/sub.

Falls back to an in-process fake when Redis is unavailable so that unit tests
and local runs without a Redis server still work.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

QUEUE_KEY = "taskflow:queue:pending"
EVENTS_CHANNEL = "taskflow:events"


def worker_key(worker_id: str) -> str:
    return f"taskflow:worker:{worker_id}"


def heartbeat_key(worker_id: str) -> str:
    return f"taskflow:heartbeat:{worker_id}"


def task_lock_key(task_id: str) -> str:
    return f"taskflow:locks:task:{task_id}"


class _FakeRedis:
    """Minimal async in-memory stand-in for the Redis commands we use."""

    def __init__(self) -> None:
        self.store: dict[str, Any] = {}
        self.zsets: dict[str, dict[str, float]] = {}
        self.subscribers: list[asyncio.Queue] = []

    async def ping(self) -> bool:
        return True

    async def set(self, key: str, value: Any, ex: int | None = None) -> None:
        self.store[key] = value

    async def get(self, key: str) -> Any:
        return self.store.get(key)

    async def delete(self, *keys: str) -> None:
        for key in keys:
            self.store.pop(key, None)

    async def hset(self, key: str, mapping: dict[str, Any]) -> None:
        self.store.setdefault(key, {}).update(mapping)

    async def hgetall(self, key: str) -> dict[str, Any]:
        return dict(self.store.get(key, {}))

    async def set_nx(self, key: str, value: Any, ex: int | None = None) -> bool:
        if key in self.store:
            return False
        self.store[key] = value
        return True

    async def zadd(self, key: str, mapping: dict[str, float]) -> None:
        self.zsets.setdefault(key, {}).update(mapping)

    async def zcard(self, key: str) -> int:
        return len(self.zsets.get(key, {}))

    async def zrem(self, key: str, member: str) -> None:
        self.zsets.get(key, {}).pop(member, None)

    async def zpopmax(self, key: str, count: int = 1) -> list[tuple[str, float]]:
        items = sorted(self.zsets.get(key, {}).items(), key=lambda kv: kv[1], reverse=True)
        popped = items[:count]
        for member, _ in popped:
            self.zsets[key].pop(member, None)
        return popped

    async def publish(self, _channel: str, payload: str) -> None:
        for queue in list(self.subscribers):
            queue.put_nowait(payload)

    async def close(self) -> None:
        return None


class RedisGateway:
    """Thin facade around Redis with graceful degradation."""

    def __init__(self) -> None:
        self._client: Any | None = None
        self._fake = _FakeRedis()
        self.degraded = True

    async def connect(self) -> None:
        try:
            client = aioredis.from_url(settings.redis_url, decode_responses=True)
            await client.ping()
            self._client = client
            self.degraded = False
        except Exception:
            self._client = None
            self.degraded = True

    async def disconnect(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None

    @property
    def client(self) -> Any:
        return self._client or self._fake

    async def healthy(self) -> bool:
        try:
            return bool(await self.client.ping())
        except Exception:
            return False

    # ---- queue -----------------------------------------------------------
    async def enqueue(self, task_id: str, score: float) -> None:
        await self.client.zadd(QUEUE_KEY, {task_id: score})

    async def dequeue(self, count: int = 1) -> list[str]:
        popped = await self.client.zpopmax(QUEUE_KEY, count)
        return [item[0] if isinstance(item, (tuple, list)) else item for item in popped]

    async def queue_depth(self) -> int:
        return int(await self.client.zcard(QUEUE_KEY) or 0)

    async def remove_from_queue(self, task_id: str) -> None:
        await self.client.zrem(QUEUE_KEY, task_id)

    # ---- worker cache ----------------------------------------------------
    async def cache_worker(self, worker_id: str, state: dict[str, Any]) -> None:
        await self.client.set(worker_key(worker_id), json.dumps(state, default=str))
        await self.client.set(
            heartbeat_key(worker_id), state.get("last_heartbeat", ""), ex=60
        )

    async def cached_worker(self, worker_id: str) -> dict[str, Any] | None:
        raw = await self.client.get(worker_key(worker_id))
        return json.loads(raw) if raw else None

    # ---- locks -----------------------------------------------------------
    async def acquire_task_lock(self, task_id: str, ttl: int = 30) -> bool:
        key = task_lock_key(task_id)
        if isinstance(self.client, _FakeRedis):
            return await self.client.set_nx(key, "1", ex=ttl)
        return bool(await self.client.set(key, "1", ex=ttl, nx=True))

    async def release_task_lock(self, task_id: str) -> None:
        await self.client.delete(task_lock_key(task_id))

    # ---- worker control flags -------------------------------------------
    async def set_worker_paused(self, worker_id: str, paused: bool) -> None:
        key = f"taskflow:worker:{worker_id}:paused"
        if paused:
            await self.client.set(key, "1")
        else:
            await self.client.delete(key)

    async def worker_paused(self, worker_id: str) -> bool:
        return bool(await self.client.get(f"taskflow:worker:{worker_id}:paused"))

    # ---- pub/sub ---------------------------------------------------------
    async def publish_event(self, event: dict[str, Any]) -> None:
        await self.client.publish(EVENTS_CHANNEL, json.dumps(event, default=str))


redis_gateway = RedisGateway()
