"""Health and system status endpoints (they really probe dependencies)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import check_database, get_session
from app.core.redis import redis_gateway
from app.fault_tolerance.failure_detector import failure_detector
from app.scheduler.engine import scheduler_engine
from app.services import resource_service
from app.websocket.manager import ws_manager

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness/readiness probe for all dependencies")
async def health() -> dict:
    database = "healthy" if await check_database() else "unhealthy"
    redis = "healthy" if await redis_gateway.healthy() and not redis_gateway.degraded else (
        "degraded" if await redis_gateway.healthy() else "unhealthy"
    )
    scheduler = "healthy" if scheduler_engine.healthy else "unhealthy"
    status = "healthy" if database == "healthy" and scheduler == "healthy" else "degraded"
    return {
        "status": status,
        "database": database,
        "redis": redis,
        "scheduler": scheduler,
        "failure_detector": "healthy" if failure_detector.healthy else "unhealthy",
    }


@router.get("/api/system/status", summary="Aggregated system health for the dashboard")
async def system_status(session: AsyncSession = Depends(get_session)) -> dict:
    health_state = await resource_service.system_health(session)
    return {**health_state, "websocket_clients": ws_manager.count}
