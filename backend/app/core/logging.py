"""Structured logging helpers shared by every backend component."""
from __future__ import annotations

import json
import logging
import sys
from typing import Any

from app.core.config import settings

_configured = False


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "component": getattr(record, "component", record.name),
            "worker_id": getattr(record, "worker_id", None),
            "task_id": getattr(record, "task_id", None),
            "message": record.getMessage(),
            "metadata": getattr(record, "metadata", None),
        }
        return json.dumps({k: v for k, v in payload.items() if v is not None})


def configure_logging() -> None:
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.log_level.upper())
    _configured = True


def get_logger(component: str) -> logging.LoggerAdapter:
    configure_logging()
    return logging.LoggerAdapter(logging.getLogger(component), {"component": component})
