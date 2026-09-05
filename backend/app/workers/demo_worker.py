"""Runnable demo worker.

    python -m app.workers.demo_worker worker-01
    python -m app.workers.demo_worker worker-02 --api http://localhost:8000
"""
from __future__ import annotations

import argparse
import asyncio
import os

from app.workers.worker_runtime import WorkerRuntime


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="TaskFlow demo worker node")
    parser.add_argument("worker_id", help="unique worker id, e.g. worker-01")
    parser.add_argument("--api", default=os.getenv("API_URL", "http://localhost:8000"))
    parser.add_argument("--cpu", type=float, default=float(os.getenv("WORKER_CPU", "8")))
    parser.add_argument("--memory", type=float, default=float(os.getenv("WORKER_MEMORY", "16384")))
    parser.add_argument("--concurrency", type=int, default=4)
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    runtime = WorkerRuntime(
        args.worker_id,
        api_url=args.api,
        cpu_capacity=args.cpu,
        memory_capacity=args.memory,
        max_concurrent=args.concurrency,
    )
    try:
        await runtime.start()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await runtime.stop()


if __name__ == "__main__":
    asyncio.run(main())
