"""Event names and the publish helper used across the backend."""
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.redis import redis_gateway
from app.models.system_event import SystemEvent
from app.utils.time import utcnow
from app.websocket.manager import ws_manager

TASK_CREATED = "TASK_CREATED"
TASK_ASSIGNED = "TASK_ASSIGNED"
TASK_STARTED = "TASK_STARTED"
TASK_COMPLETED = "TASK_COMPLETED"
TASK_FAILED = "TASK_FAILED"
TASK_RETRYING = "TASK_RETRYING"
TASK_CANCELLED = "TASK_CANCELLED"
WORKER_REGISTERED = "WORKER_REGISTERED"
WORKER_HEARTBEAT = "WORKER_HEARTBEAT"
WORKER_FAILED = "WORKER_FAILED"
WORKER_RECOVERED = "WORKER_RECOVERED"
RESOURCE_UPDATED = "RESOURCE_UPDATED"
SCHEDULER_DECISION = "SCHEDULER_DECISION"
SYSTEM_HEALTH_CHANGED = "SYSTEM_HEALTH_CHANGED"

log = get_logger("events")


async def emit(
    session: AsyncSession | None,
    event: str,
    *,
    message: str,
    component: str = "system",
    level: str = "INFO",
    worker_id: str | None = None,
    task_id: str | None = None,
    data: dict[str, Any] | None = None,
    persist: bool = True,
) -> None:
    """Persist an event, publish it on Redis and push it to WebSocket clients."""
    payload = {
        "event": event,
        "timestamp": utcnow().isoformat(),
        "level": level,
        "component": component,
        "message": message,
        "data": {"worker_id": worker_id, "task_id": task_id, **(data or {})},
    }

    if persist and session is not None:
        session.add(
            SystemEvent(
                event_type=event,
                level=level,
                component=component,
                worker_id=worker_id,
                task_id=task_id,
                message=message,
                event_metadata=data,
            )
        )

    log.info(message, extra={"component": component, "worker_id": worker_id, "task_id": task_id})
    await redis_gateway.publish_event(payload)
    await ws_manager.broadcast(payload)
