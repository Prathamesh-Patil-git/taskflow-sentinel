from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.models.task import TaskStatus
from app.schemas.task import TaskCreate
from app.services import task_service


async def test_create_task_queues_it(session):
    task = await task_service.create_task(
        session, TaskCreate(name="Image Processing", priority="HIGH", cpu_required=2)
    )
    await session.commit()
    assert task.task_id.startswith("T-")
    assert task.status is TaskStatus.QUEUED
    assert task.queued_at is not None


async def test_task_validation_rejects_bad_input():
    with pytest.raises(Exception):
        TaskCreate(name="", cpu_required=-1)


async def test_invalid_transition_is_blocked(session):
    task = await task_service.create_task(session, TaskCreate(name="X"))
    with pytest.raises(HTTPException):
        task_service.transition(task, TaskStatus.COMPLETED)


async def test_api_create_and_list(client):
    response = await client.post(
        "/api/tasks",
        json={"name": "ETL", "priority": "CRITICAL", "cpu_required": 1, "memory_required": 256},
    )
    assert response.status_code == 201
    listing = await client.get("/api/tasks")
    assert listing.status_code == 200
    assert len(listing.json()) == 1
