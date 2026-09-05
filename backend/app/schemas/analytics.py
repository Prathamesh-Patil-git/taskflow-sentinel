from __future__ import annotations

from pydantic import BaseModel


class AnalyticsOverview(BaseModel):
    total_tasks: int
    success_rate: float
    failure_rate: float
    retry_rate: float
    average_execution_time: float
    average_queue_time: float
    average_scheduling_latency: float
    average_recovery_time: float
    throughput: float
    cpu_utilization: float
    memory_utilization: float
    worker_utilization: float
    worker_availability: float


class AlgorithmComparison(BaseModel):
    algorithm: str
    average_completion_time: float
    average_queue_time: float
    cpu_utilization: float
    memory_utilization: float
    scheduling_latency: float
    failure_rate: float
    throughput: float
