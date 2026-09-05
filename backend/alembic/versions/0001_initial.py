"""initial schema

Revision ID: 0001
Revises:
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

WORKER_STATUS = sa.Enum(
    "ONLINE", "BUSY", "OVERLOADED", "FAILED", "OFFLINE", name="workerstatus", native_enum=False
)
TASK_PRIORITY = sa.Enum("CRITICAL", "HIGH", "MEDIUM", "LOW", name="taskpriority", native_enum=False)
TASK_STATUS = sa.Enum(
    "PENDING", "QUEUED", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "RETRYING", "CANCELLED",
    name="taskstatus", native_enum=False,
)
FAULT_TYPE = sa.Enum(
    "HEARTBEAT_TIMEOUT", "WORKER_CRASH", "RESOURCE_EXHAUSTION", "TASK_FAILURE", "NETWORK_FAILURE",
    name="faulttype", native_enum=False,
)
FAULT_SEVERITY = sa.Enum("INFO", "WARNING", "ERROR", "CRITICAL", name="faultseverity", native_enum=False)
FAULT_STATUS = sa.Enum(
    "DETECTED", "RECOVERING", "RECOVERED", "UNRESOLVED", name="faultstatus", native_enum=False
)


def upgrade() -> None:
    op.create_table(
        "workers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("worker_id", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("hostname", sa.String(255), nullable=False, server_default="localhost"),
        sa.Column("status", WORKER_STATUS, nullable=False, server_default="ONLINE"),
        sa.Column("cpu_capacity", sa.Float, nullable=False, server_default="8"),
        sa.Column("cpu_usage", sa.Float, nullable=False, server_default="0"),
        sa.Column("memory_capacity", sa.Float, nullable=False, server_default="16384"),
        sa.Column("memory_usage", sa.Float, nullable=False, server_default="0"),
        sa.Column("active_tasks", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_tasks_completed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_tasks_failed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("reliability_score", sa.Float, nullable=False, server_default="100"),
        sa.Column("uptime_seconds", sa.Integer, nullable=False, server_default="0"),
        sa.Column("region", sa.String(64), nullable=False, server_default="local"),
        sa.Column("last_heartbeat", sa.DateTime(timezone=True)),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("task_id", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("task_type", sa.String(32), nullable=False, server_default="RANDOM_TASK"),
        sa.Column("priority", TASK_PRIORITY, nullable=False, server_default="MEDIUM"),
        sa.Column("status", TASK_STATUS, nullable=False, server_default="PENDING"),
        sa.Column("cpu_required", sa.Float, nullable=False, server_default="1"),
        sa.Column("memory_required", sa.Float, nullable=False, server_default="512"),
        sa.Column("estimated_duration", sa.Float, nullable=False, server_default="10"),
        sa.Column("actual_duration", sa.Float),
        sa.Column("assigned_worker_id", sa.String(64), index=True),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer, nullable=False, server_default="3"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("queued_at", sa.DateTime(timezone=True)),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("failed_at", sa.DateTime(timezone=True)),
        sa.Column("result", sa.Text),
        sa.Column("error_message", sa.Text),
    )

    op.create_table(
        "task_attempts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("task_id", sa.String(64), nullable=False, index=True),
        sa.Column("worker_id", sa.String(64), index=True),
        sa.Column("attempt_number", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.String(24), nullable=False, server_default="RUNNING"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("execution_time", sa.Float),
        sa.Column("error_message", sa.Text),
    )

    op.create_table(
        "faults",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("fault_id", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("worker_id", sa.String(64), index=True),
        sa.Column("fault_type", FAULT_TYPE, nullable=False),
        sa.Column("severity", FAULT_SEVERITY, nullable=False, server_default="ERROR"),
        sa.Column("status", FAULT_STATUS, nullable=False, server_default="DETECTED"),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("recovered_at", sa.DateTime(timezone=True)),
        sa.Column("affected_tasks", sa.Integer, nullable=False, server_default="0"),
        sa.Column("recovery_time", sa.Float),
        sa.Column("description", sa.Text),
    )

    op.create_table(
        "system_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("event_type", sa.String(48), nullable=False, index=True),
        sa.Column("level", sa.String(16), nullable=False, server_default="INFO"),
        sa.Column("component", sa.String(48), nullable=False, server_default="system"),
        sa.Column("worker_id", sa.String(64), index=True),
        sa.Column("task_id", sa.String(64), index=True),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("metadata", JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "scheduler_config",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("algorithm", sa.String(32), nullable=False, server_default="RESOURCE_AWARE"),
        sa.Column("tasks_scheduled", sa.Integer, nullable=False, server_default="0"),
        sa.Column("successful_assignments", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rejected_assignments", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_scheduling_latency", sa.Float, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    for table in (
        "scheduler_config",
        "system_events",
        "faults",
        "task_attempts",
        "tasks",
        "workers",
    ):
        op.drop_table(table)
