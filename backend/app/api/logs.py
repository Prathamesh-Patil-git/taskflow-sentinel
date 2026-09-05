from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.services import analytics_service
from app.utils.time import epoch_ms

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("", summary="Structured system log entries")
async def get_logs(
    level: str | None = Query(default=None),
    worker_id: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=160),
    limit: int = Query(default=300, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
):
    rows = await analytics_service.logs(
        session, level=level, worker_id=worker_id, search=search, limit=limit
    )
    return [
        {
            "id": str(row.id),
            "timestamp": epoch_ms(row.created_at),
            "level": row.level,
            "component": row.component,
            "worker_id": row.worker_id,
            "task_id": row.task_id,
            "message": row.message,
            "metadata": row.event_metadata,
        }
        for row in rows
    ]
