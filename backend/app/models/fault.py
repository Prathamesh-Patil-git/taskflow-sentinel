from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FaultType(str, enum.Enum):
    HEARTBEAT_TIMEOUT = "HEARTBEAT_TIMEOUT"
    WORKER_CRASH = "WORKER_CRASH"
    RESOURCE_EXHAUSTION = "RESOURCE_EXHAUSTION"
    TASK_FAILURE = "TASK_FAILURE"
    NETWORK_FAILURE = "NETWORK_FAILURE"


class FaultSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class FaultStatus(str, enum.Enum):
    DETECTED = "DETECTED"
    RECOVERING = "RECOVERING"
    RECOVERED = "RECOVERED"
    UNRESOLVED = "UNRESOLVED"


class Fault(Base):
    __tablename__ = "faults"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fault_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    worker_id: Mapped[str | None] = mapped_column(String(64), index=True)
    fault_type: Mapped[FaultType] = mapped_column(Enum(FaultType, native_enum=False))
    severity: Mapped[FaultSeverity] = mapped_column(
        Enum(FaultSeverity, native_enum=False), default=FaultSeverity.ERROR
    )
    status: Mapped[FaultStatus] = mapped_column(
        Enum(FaultStatus, native_enum=False), default=FaultStatus.DETECTED, index=True
    )
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    recovered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    affected_tasks: Mapped[int] = mapped_column(Integer, default=0)
    recovery_time: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)
