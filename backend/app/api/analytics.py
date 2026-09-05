from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", summary="Headline analytics computed from real history")
async def overview(session: AsyncSession = Depends(get_session)):
    return await analytics_service.overview(session)


@router.get("/tasks", summary="Hourly task submission / completion / failure buckets")
async def tasks(
    hours: int = Query(default=24, ge=1, le=168), session: AsyncSession = Depends(get_session)
):
    return await analytics_service.task_analytics(session, hours=hours)


@router.get("/resources", summary="Resource utilisation analytics")
async def resources(session: AsyncSession = Depends(get_session)):
    return await analytics_service.resource_analytics(session)


@router.get("/scheduling", summary="Scheduling algorithm comparison")
async def scheduling(session: AsyncSession = Depends(get_session)):
    return await analytics_service.scheduling_comparison(session)
