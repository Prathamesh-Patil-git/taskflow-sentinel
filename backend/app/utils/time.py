from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def seconds_since(value: datetime | None) -> float:
    moment = aware(value)
    if moment is None:
        return float("inf")
    return (utcnow() - moment).total_seconds()


def epoch_ms(value: datetime | None) -> int | None:
    moment = aware(value)
    return int(moment.timestamp() * 1000) if moment else None
