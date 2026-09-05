"""Worker runtime: registers, heartbeats with real psutil metrics, polls
assignments and executes real Python workloads.

This module runs inside each worker container (`worker-01` .. `worker-04`).
Every metric it reports is measured from the operating system through psutil —
nothing here is simulated.
"""
from __future__ import annotations

import asyncio
import math
import os
import random
import socket
import time

import psutil

from app.core.logging import get_logger
from app.workers.worker_manager import WorkerClient

log = get_logger("worker-runtime")

TASK_TYPES = (
    "CPU_TASK",
    "MEMORY_TASK",
    "SLEEP_TASK",
    "FAILURE_TASK",
    "MIXED_TASK",
    "RANDOM_TASK",
)

MAX_TASK_SECONDS = 120.0
#: Hard ceiling for MEMORY_TASK allocations so a container can never be OOM-killed.
MAX_ALLOC_MB = 512


def _burn_cpu(seconds: float) -> int:
    """Genuinely saturate a CPU core for `seconds` (no sleeping)."""
    deadline = time.monotonic() + seconds
    acc = 0
    while time.monotonic() < deadline:
        for i in range(20_000):
            acc += int(math.sqrt(i) * math.sin(i))
    return acc


async def execute_task(task: dict) -> str:
    """Run one real workload. Raises RuntimeError for intentional failures."""
    task_type = task.get("task_type", "RANDOM_TASK")
    duration = min(float(task.get("estimated_duration", 5) or 5), MAX_TASK_SECONDS)

    if task_type == "RANDOM_TASK":
        task_type = random.choice(["CPU_TASK", "MEMORY_TASK", "SLEEP_TASK", "MIXED_TASK"])

    if task_type == "CPU_TASK":
        # Real CPU work, off the event loop so heartbeats keep flowing.
        acc = await asyncio.to_thread(_burn_cpu, duration)
        return f"CPU_TASK burned {duration:.1f}s on {os.cpu_count()} core(s), checksum {acc % 99991}"

    if task_type == "MEMORY_TASK":
        megabytes = int(min(float(task.get("memory_required", 256) or 256), MAX_ALLOC_MB))
        blob = bytearray(megabytes * 1024 * 1024)
        for offset in range(0, len(blob), 4096):  # touch pages so they are resident
            blob[offset] = 1
        await asyncio.sleep(duration)
        held = len(blob)
        del blob
        return f"MEMORY_TASK held {held // (1024 * 1024)}MB for {duration:.1f}s"

    if task_type == "SLEEP_TASK":
        await asyncio.sleep(duration)
        return f"SLEEP_TASK waited {duration:.1f}s (I/O bound)"

    if task_type == "MIXED_TASK":
        slice_seconds = max(0.5, duration / 4)
        for _ in range(2):
            await asyncio.to_thread(_burn_cpu, slice_seconds)
            await asyncio.sleep(slice_seconds)
        return f"MIXED_TASK alternated CPU and I/O for {duration:.1f}s"

    if task_type == "FAILURE_TASK":
        await asyncio.sleep(min(duration, 3))
        raise RuntimeError("FAILURE_TASK: intentional failure for fault-tolerance demo")

    raise RuntimeError(f"unknown task type {task_type}")


class WorkerRuntime:
    """One worker node: registration, heartbeat, assignment polling, execution."""

    def __init__(
        self,
        worker_id: str,
        *,
        api_url: str,
        cpu_capacity: float | None = None,
        memory_capacity: float | None = None,
        heartbeat_interval: float = 2.0,
        max_concurrent: int = 4,
    ) -> None:
        self.worker_id = worker_id
        self.client = WorkerClient(api_url, worker_id)
        self.process = psutil.Process()
        self.cpu_capacity = float(cpu_capacity or psutil.cpu_count(logical=True) or 1)
        self.memory_capacity = float(
            memory_capacity or psutil.virtual_memory().total / (1024 * 1024)
        )
        self.heartbeat_interval = heartbeat_interval
        self.max_concurrent = max_concurrent
        self.running: dict[str, asyncio.Task] = {}
        self.started_at = time.time()
        self.paused = False
        self._stop = asyncio.Event()
        psutil.cpu_percent(interval=None)  # prime the sampler

    # ---- lifecycle -------------------------------------------------------
    async def start(self) -> None:
        await self._register_with_retry()
        await asyncio.gather(self._heartbeat_loop(), self._work_loop(), self._control_loop())

    async def stop(self) -> None:
        self._stop.set()
        for task in list(self.running.values()):
            task.cancel()
        await self.client.close()

    async def _register_with_retry(self) -> None:
        while not self._stop.is_set():
            try:
                info = await self.client.register(
                    socket.gethostname(), self.cpu_capacity, self.memory_capacity
                )
                self.heartbeat_interval = float(
                    info.get("heartbeat_interval", self.heartbeat_interval)
                )
                log.info(
                    f"{self.worker_id} registered "
                    f"({self.cpu_capacity:.0f} cores / {self.memory_capacity:.0f}MB)",
                    extra={"worker_id": self.worker_id},
                )
                return
            except Exception as exc:  # backend not up yet
                log.warning(f"registration retry: {exc}", extra={"worker_id": self.worker_id})
                await asyncio.sleep(2)

    # ---- real metrics ----------------------------------------------------
    def metrics(self) -> dict:
        cpu_percent = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        return {
            "cpu_usage": round(self.cpu_capacity * cpu_percent / 100, 3),
            "memory_usage": round((memory.total - memory.available) / (1024 * 1024), 1),
            "cpu_percent": round(cpu_percent, 1),
            "memory_percent": round(memory.percent, 1),
            "memory_available": float(memory.available),
            "cpu_count": psutil.cpu_count(logical=True) or 1,
            "uptime_seconds": round(time.time() - self.started_at, 1),
            "active_tasks": len(self.running),
        }

    # ---- loops -----------------------------------------------------------
    async def _control_loop(self) -> None:
        """Poll the backend kill-switch used by POST /simulate-failure."""
        while not self._stop.is_set():
            try:
                paused = bool((await self.client.control()).get("paused"))
                if paused and not self.paused:
                    log.warning(
                        f"{self.worker_id} entering simulated failure: heartbeat stopped",
                        extra={"worker_id": self.worker_id},
                    )
                    for task in list(self.running.values()):
                        task.cancel()
                    self.running.clear()
                elif self.paused and not paused:
                    log.info(f"{self.worker_id} resumed", extra={"worker_id": self.worker_id})
                    await self._register_with_retry()
                self.paused = paused
            except Exception:
                pass
            await asyncio.sleep(1.0)

    async def _heartbeat_loop(self) -> None:
        while not self._stop.is_set():
            if not self.paused:
                try:
                    await self.client.heartbeat(self.metrics())
                except Exception as exc:
                    log.warning(f"heartbeat failed: {exc}", extra={"worker_id": self.worker_id})
            await asyncio.sleep(self.heartbeat_interval)

    async def _work_loop(self) -> None:
        while not self._stop.is_set():
            try:
                if not self.paused and len(self.running) < self.max_concurrent:
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
        try:
            await self.client.start_task(task_id)
            result = await execute_task(task)
            await self.client.complete_task(task_id, result)
            log.info(f"{task_id} completed", extra={"worker_id": self.worker_id, "task_id": task_id})
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            try:
                await self.client.fail_task(task_id, str(exc))
            except Exception:
                pass
            log.error(f"{task_id} failed: {exc}", extra={"worker_id": self.worker_id})
        finally:
            self.running.pop(task_id, None)


# Backwards compatible alias used by earlier code/tests.
execute_demo_task = execute_task
