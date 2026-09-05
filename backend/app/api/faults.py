from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.fault import FaultOut
from app.services import fault_service

router = APIRouter(prefix="/api/faults", tags=["faults"])


@router.get("", summary="Fault summary and recent fault records")
async def list_faults(session: AsyncSession = Depends(get_session)):
    faults = await fault_service.list_faults(session)
    summary = await fault_service.fault_summary(session)
    payload = []
    for fault in faults:
        item = FaultOut.model_validate(fault).model_dump()
        item["events"] = await fault_service.fault_timeline(session, fault)
        payload.append(item)
    return {**summary, "faults": payload}


@router.get("/{fault_id}", summary="Fault detail with its real event timeline")
async def get_fault(fault_id: str, session: AsyncSession = Depends(get_session)):
    fault = await fault_service.get_fault(session, fault_id)
    item = FaultOut.model_validate(fault).model_dump()
    item["events"] = await fault_service.fault_timeline(session, fault)
    return item
