from __future__ import annotations


def safe_ratio(numerator: float, denominator: float) -> float:
    return float(numerator) / float(denominator) if denominator else 0.0


def percent(numerator: float, denominator: float, digits: int = 1) -> float:
    return round(safe_ratio(numerator, denominator) * 100, digits)


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def average(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0
