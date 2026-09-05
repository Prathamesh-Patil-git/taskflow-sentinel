from app.scheduler.strategies.base import SchedulerStrategy, WorkerScore
from app.scheduler.strategies.least_loaded import LeastLoadedStrategy
from app.scheduler.strategies.priority import PriorityBasedStrategy
from app.scheduler.strategies.resource_aware import ResourceAwareStrategy
from app.scheduler.strategies.round_robin import RoundRobinStrategy

STRATEGIES: dict[str, SchedulerStrategy] = {
    "ROUND_ROBIN": RoundRobinStrategy(),
    "LEAST_LOADED": LeastLoadedStrategy(),
    "RESOURCE_AWARE": ResourceAwareStrategy(),
    "PRIORITY_BASED": PriorityBasedStrategy(),
}


def get_strategy(name: str) -> SchedulerStrategy:
    return STRATEGIES.get(name.upper(), STRATEGIES["RESOURCE_AWARE"])


__all__ = [
    "LeastLoadedStrategy",
    "PriorityBasedStrategy",
    "ResourceAwareStrategy",
    "RoundRobinStrategy",
    "STRATEGIES",
    "SchedulerStrategy",
    "WorkerScore",
    "get_strategy",
]
