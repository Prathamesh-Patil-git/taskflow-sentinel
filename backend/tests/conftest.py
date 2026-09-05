from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6399/15")  # unreachable -> fake redis

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core import database
from app.core.database import Base
from app.core.redis import redis_gateway
from app.models.scheduler import SchedulerConfig
from app.schemas.worker import HeartbeatIn, WorkerRegisterIn
from app.services import worker_service

pytest_plugins = ("pytest_asyncio",)


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    database.SessionLocal = factory  # engine/detector loops use the same DB

    # fresh fake redis per test
    redis_gateway._client = None
    from app.core.redis import _FakeRedis

    redis_gateway._fake = _FakeRedis()

    async with factory() as db:
        db.add(SchedulerConfig(algorithm="RESOURCE_AWARE"))
        await db.commit()
        yield db
    await engine.dispose()


@pytest_asyncio.fixture
async def client(session):
    from app.main import app

    async def override():
        yield session

    app.dependency_overrides[database.get_session] = override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def workers(session):
    created = []
    for index in range(1, 4):
        worker = await worker_service.register_worker(
            session,
            WorkerRegisterIn(
                worker_id=f"worker-{index:02d}",
                hostname=f"node-{index}",
                cpu_capacity=8,
                memory_capacity=16384,
            ),
        )
        await worker_service.heartbeat(
            session, worker.worker_id, HeartbeatIn(cpu_usage=0, memory_usage=0, active_tasks=0)
        )
        created.append(worker)
    await session.commit()
    return created


@pytest.fixture(autouse=True)
def anyio_backend():
    return "asyncio"
