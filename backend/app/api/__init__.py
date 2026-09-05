from fastapi import APIRouter

from app.api import (
    analytics,
    dashboard,
    faults,
    health,
    logs,
    resources,
    scheduler,
    tasks,
    workers,
)

api_router = APIRouter()
api_router.include_router(dashboard.router)
api_router.include_router(tasks.router)
api_router.include_router(workers.router)
api_router.include_router(scheduler.router)
api_router.include_router(resources.router)
api_router.include_router(faults.router)
api_router.include_router(analytics.router)
api_router.include_router(logs.router)
api_router.include_router(health.router)

__all__ = ["api_router"]
