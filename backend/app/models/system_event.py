from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.core.database import Base

JSONType = JSON().with_variant(JSONB, "postgresql")


class SystemEvent(Base):
    """Scheduler decisions, lifecycle events and structured logs."""

    __tablename__ = "system_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(48), index=True)
    level: Mapped[str] = mapped_column(String(16), default="INFO", index=True)
    component: Mapped[str] = mapped_column(String(48), default="system", index=True)
    worker_id: Mapped[str | None] = mapped_column(String(64), index=True)
    task_id: Mapped[str | None] = mapped_column(String(64), index=True)
    message: Mapped[str] = mapped_column(Text)
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSONType)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
