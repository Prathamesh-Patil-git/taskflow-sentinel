"""Async SQLAlchemy 2.x engine, session factory and declarative base."""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a request scoped session."""
    async with SessionLocal() as session:
        yield session


async def init_models() -> None:
    """Create tables when Alembic has not been run (dev/test convenience)."""
    import app.models  # noqa: F401  ensures metadata is populated

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def check_database() -> bool:
    from sqlalchemy import text

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:  # pragma: no cover - health probe
        return False
