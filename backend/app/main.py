"""TaskFlow Sentinel API — FastAPI application entry point."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.core.database import init_models
from app.core.logging import configure_logging, get_logger
from app.core.redis import redis_gateway
from app.fault_tolerance.failure_detector import failure_detector
from app.scheduler.engine import scheduler_engine
from app.services.resource_service import metric_sampler
from app.utils.time import utcnow
from app.websocket.manager import ws_manager

log = get_logger("main")


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    await redis_gateway.connect()
    await init_models()
    await scheduler_engine.start()
    await failure_detector.start()
    await metric_sampler.start()
    log.info("TaskFlow Sentinel backend started")
    try:
        yield
    finally:
        await metric_sampler.stop()
        await failure_detector.stop()
        await scheduler_engine.stop()
        await redis_gateway.disconnect()


app = FastAPI(
    title="TaskFlow Sentinel API",
    description=(
        "Fault-tolerant distributed task scheduling and resource allocation system. "
        "REST + WebSocket API backing the TaskFlow monitoring dashboard."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.websocket("/ws/dashboard")
async def dashboard_socket(websocket: WebSocket) -> None:
    """Pushes every scheduler, worker, task and fault event to the dashboard."""
    await ws_manager.connect(websocket)
    await websocket.send_json(
        {"event": "CONNECTED", "timestamp": utcnow().isoformat(), "data": {}}
    )
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=20)
            except asyncio.TimeoutError:
                await websocket.send_json(
                    {"event": "PING", "timestamp": utcnow().isoformat(), "data": {}}
                )
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(websocket)
