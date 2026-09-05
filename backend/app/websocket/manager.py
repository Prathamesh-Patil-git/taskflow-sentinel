"""Fan-out manager for WS /ws/dashboard connections."""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    @property
    def count(self) -> int:
        return len(self._connections)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        if not self._connections:
            return
        async with self._lock:
            targets = list(self._connections)
        dead: list[WebSocket] = []
        for connection in targets:
            try:
                await connection.send_json(payload)
            except Exception:
                dead.append(connection)
        if dead:
            async with self._lock:
                for connection in dead:
                    self._connections.discard(connection)


ws_manager = ConnectionManager()
