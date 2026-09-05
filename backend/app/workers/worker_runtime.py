"""Worker runtime: registers, heartbeats, polls assignments and executes tasks."""
from __future__ import annotations

import asyncio
import random
import socket
import time

from app.core.logging import get_logger
from app.workers.worker_manager import WorkerClient

log = get_logger("worker-runtime")

TASK_TYPES = ("CPU_TASK", "MEMORY_TASK", "SLEEP_TASK", "FAILURE_TASK", "RANDOM_TASK")


async def execute_demo_task(task: dict) -> str:
    """Run one of the demo workloads. Raises RuntimeError on intentional failure."""
    task_type = task.get("task_type", "RANDOM_TASK")
    duration = float(task.get("estimated_duration", 5))

    if task_type == "RANDOM_TASK":
        task_type = random.choice(["CPU_TASK", "MEMORY_TASK", "SLEEP_TASK"])

    if task_type == "CPU_TASK":
        deadline = time.time() + min(duration, 15)
        total = 0
        while time.time() < deadline:
            total += sum(i * i for i in range(5000))
            await asyncio.sleep(0)
        return f"cpu checksum {total % 100000}"

    if task_type == "MEMORY_TASK":
        blob = bytearray(int(task.get("memory_required", 512)) * 1024)
        await asyncio.sleep(min(duration, 15))
        return f"allocated {len(blob) // 1024} KiB"

    if task_type == "FAILURE_TASK":
        await asyncio.sleep(min(duration, 3))
        raise RuntimeError("intentional failure for retry demonstration")

    await asyncio.sleep(min(duration, 20))
    return "sleep task finished"


class WorkerRuntime:
    def __init__(
        self,
        worker_id: str,
        api_url: str = "http://localhost:8000",
        cpu_capacity: float = 8,
        memory_capacity: float = 16384,
        heartbeat_interval: float = 2.0,
        max_concurrent: int = 4,
    ) -> None:
        self.worker_id = worker_id
        self.client = WorkerClient(api_url, worker_id)
        self.cpu_capacity = cpu_capacity
        self.memory_capacity = memory_capacity
        self.heartbeat_interval = heartbeat_interval
        self.max_concurrent = max_concurrent
        self.running: dict[str, asyncio.Task] = {}
        self.cpu_usage = 0.0
        self.memory_usage = 0.0
        self._stop = asyncio.Event()

    async def start(self) -> None:
        info = await self.client.register(
            socket.gethostname(), self.cpu_capacity, self.memory_capacity
        )
        self.heartbeat_interval = float(info.get("heartbeat_interval", self.heartbeat_interval))
        log.info(f"{self.worker_id} registered", extra={"worker_id": self.worker_id})
        await asyncio.gather(self._heartbeat_loop(), self._work_loop())

    async def stop(self) -> None:
        self._stop.set()
        await self.client.close()

    async def _heartbeat_loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self.client.heartbeat(
                    round(self.cpu_usage, 2), round(self.memory_usage, 2), len(self.running)
                )
            except Exception as exc:
                log.warning(f"heartbeat failed: {exc}", extra={"worker_id": self.worker_id})
            await asyncio.sleep(self.heartbeat_interval)

    async def _work_loop(self) -> None:
        while not self._stop.is_set():
            try:
                if len(self.running) < self.max_concurrent:
                    for task in await self.client.assignments():
                        if task["task_id"] in self.running:
                            continue
                        self.running[task["task_id"]] = asyncio.create_task(self._run(task))
                        if len(self.running) >= self.max_concurrent:
                            break
            except Exception as exc:
                log.warning(f"assignment poll failed: {exc}", extra={"worker_id": self.worker_id})
            await asyncio.sleep(1.0)

    async def _run(self, task: dict) -> None:
        task_id = task["task_id"]
        self.cpu_usage += float(task.get("cpu_required", 1))
        self.memory_usage += float(task.get("memory_required", 512))
        try:
            await self.client.start_task(task_id)
            result = await execute_demo_task(task)
            await self.client.complete_task(task_id, result)
        except Exception as exc:
            try:
                await self.client.fail_task(task_id, str(exc))
            except Exception:
                pass
        finally:
            self.cpu_usage = max(0.0, self.cpu_usage - float(task.get("cpu_required", 1)))
            self.memory_usage = max(
                0.0, self.memory_usage - float(task.get("memory_required", 512))
            )
            self.running.pop(task_id, None)
