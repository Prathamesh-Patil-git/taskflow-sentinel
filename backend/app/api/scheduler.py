from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.scheduler import AlgorithmUpdate
from app.services import scheduler_service

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


@router.get("", summary="Scheduler state, metrics and recent decisions")
async def get_scheduler(session: AsyncSession = Depends(get_session)):
    return await scheduler_service.state(session)


@router.get("/decisions", summary="Recent scheduling decisions with worker scores")
async def get_decisions(limit: int = 25, session: AsyncSession = Depends(get_session)):
    return await scheduler_service.decisions(session, limit=limit)


@router.put("/algorithm", summary="Switch the active scheduling algorithm")
async def put_algorithm(
    payload: AlgorithmUpdate, session: AsyncSession = Depends(get_session)
):
    state = await scheduler_service.set_algorithm(session, payload.algorithm)
    await session.commit()
    return state
