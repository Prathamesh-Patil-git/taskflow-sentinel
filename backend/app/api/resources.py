from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.services import resource_service

router = APIRouter(prefix="/api/resources", tags=["resources"])


@router.get("", summary="Cluster resource allocation and utilisation history")
async def get_resources(session: AsyncSession = Depends(get_session)):
    return await resource_service.resource_overview(session)
