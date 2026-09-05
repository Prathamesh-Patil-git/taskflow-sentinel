"""Helpers shared by worker runtimes talking to the API."""
from __future__ import annotations

import httpx


class WorkerClient:
    """Thin async HTTP client for the worker <-> API protocol."""

    def __init__(self, base_url: str, worker_id: str, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.worker_id = worker_id
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=timeout)

    async def close(self) -> None:
        await self._client.aclose()

    async def register(self, hostname: str, cpu_capacity: float, memory_capacity: float) -> dict:
        response = await self._client.post(
            "/api/workers/register",
            json={
                "worker_id": self.worker_id,
                "hostname": hostname,
                "cpu_capacity": cpu_capacity,
                "memory_capacity": memory_capacity,
            },
        )
        response.raise_for_status()
        return response.json()

    async def control(self) -> dict:
        response = await self._client.get(f"/api/workers/{self.worker_id}/control")
        response.raise_for_status()
        return response.json()

    async def heartbeat(self, metrics: dict) -> dict:
        response = await self._client.post(
            f"/api/workers/{self.worker_id}/heartbeat", json=metrics
        )
        if response.status_code == 409:
            return {"status": "FAILED"}
        response.raise_for_status()
        return response.json()

    async def assignments(self) -> list[dict]:
        response = await self._client.get(f"/api/workers/{self.worker_id}/assignments")
        response.raise_for_status()
        return response.json()

    async def start_task(self, task_id: str) -> None:
        await self._client.post(f"/api/tasks/{task_id}/start", json={"worker_id": self.worker_id})

    async def complete_task(self, task_id: str, result: str) -> None:
        await self._client.post(
            f"/api/tasks/{task_id}/complete",
            json={"worker_id": self.worker_id, "result": result},
        )

    async def fail_task(self, task_id: str, error_message: str) -> None:
        await self._client.post(
            f"/api/tasks/{task_id}/fail",
            json={"worker_id": self.worker_id, "error_message": error_message},
        )
