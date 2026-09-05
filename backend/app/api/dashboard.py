"""GET /api/dashboard — everything the overview screen needs in one call."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.worker import WorkerOut
from app.services import analytics_service, fault_service, resource_service, scheduler_service

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", summary="Aggregated dashboard metrics, health and time series")
async def get_dashboard(session: AsyncSession = Depends(get_session)) -> dict:
    counts = await resource_service.task_counts(session)
    util = await resource_service.cluster_utilisation(session)
    health = await resource_service.system_health(session)
    scheduler = await scheduler_service.state(session)
    analytics = await analytics_service.overview(session)
    faults = await fault_service.fault_summary(session)

    workers = util["workers"]
    live = util["live_workers"]

    return {
        "total_tasks": counts["TOTAL"],
        "pending_tasks": counts["PENDING"] + counts["QUEUED"] + counts["SCHEDULED"],
        "running_tasks": counts["RUNNING"],
        "completed_tasks": counts["COMPLETED"],
        "failed_tasks": counts["FAILED"],
        "retrying_tasks": counts["RETRYING"],
        "cancelled_tasks": counts["CANCELLED"],
        "active_workers": len(live),
        "failed_workers": len(workers) - len(live),
        "throughput": await resource_service.throughput(session),
        "success_rate": analytics["success_rate"],
        "failure_rate": analytics["failure_rate"],
        "cpu_utilization": util["cpu_utilization"],
        "memory_utilization": util["memory_utilization"],
        "system_health": health["overall"],
        "health": health,
        "scheduler_efficiency": scheduler["efficiency"],
        "average_latency": scheduler["average_latency"],
        "average_execution_time": analytics["average_execution_time"],
        "average_recovery_time": analytics["average_recovery_time"],
        "queue_depth": scheduler["queue_depth"],
        "faults": faults,
        "series": list(resource_service.SERIES),
        "workers": [WorkerOut.model_validate(w).model_dump() for w in workers],
    }
