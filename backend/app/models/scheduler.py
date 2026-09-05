from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SchedulerConfig(Base):
    """Single row holding the live scheduler configuration and counters."""

    __tablename__ = "scheduler_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    algorithm: Mapped[str] = mapped_column(String(32), default="RESOURCE_AWARE")
    tasks_scheduled: Mapped[int] = mapped_column(Integer, default=0)
    successful_assignments: Mapped[int] = mapped_column(Integer, default=0)
    rejected_assignments: Mapped[int] = mapped_column(Integer, default=0)
    total_scheduling_latency: Mapped[float] = mapped_column(Float, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
