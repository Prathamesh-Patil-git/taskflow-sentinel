# TaskFlow Sentinel — Architecture

## System Overview

TaskFlow Sentinel is a **fault-tolerant distributed task scheduling and resource allocation system** with a real-time monitoring dashboard. It demonstrates core OS concepts: process scheduling, resource management, fault tolerance, and inter-process communication — all running as Docker containers.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Compose Stack                        │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────────┐  │
│  │ PostgreSQL│  │  Redis   │  │        FastAPI Backend           │  │
│  │  :5432    │  │  :6379   │  │          :8000                   │  │
│  │           │  │          │  │  ┌───────────┐ ┌──────────────┐  │  │
│  │  Models:  │  │  Queue:  │  │  │ Scheduler │ │   Failure     │  │  │
│  │  - Tasks  │  │  Sorted  │  │  │  Engine   │ │  Detector     │  │  │
│  │  - Workers│  │  Set     │  │  │ (4 algos) │ │ (heartbeat)   │  │  │
│  │  - Faults │  │          │  │  └───────────┘ └──────────────┘  │  │
│  │  - Events │  │  PubSub  │  │  ┌───────────┐ ┌──────────────┐  │  │
│  │           │  │  Channel │  │  │   REST    │ │  WebSocket    │  │  │
│  │           │  │          │  │  │   API     │ │  /ws/dashboard│  │  │
│  └──────────┘  └──────────┘  │  └───────────┘ └──────────────┘  │  │
│       ▲              ▲       └──────────┬───────────────────────┘  │
│       │              │                  │                          │
│       └──────────────┼──────────────────┘                          │
│                      │                                             │
│  ┌───────────────────┼──────────────────────────────────────────┐  │
│  │                   │        Worker Containers                 │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │
│  │  │worker-01 │ │worker-02 │ │worker-03 │ │worker-04 │       │  │
│  │  │  psutil  │ │  psutil  │ │  psutil  │ │  psutil  │       │  │
│  │  │ metrics  │ │ metrics  │ │ metrics  │ │ metrics  │       │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Vite + React Frontend  :3000                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │Dashboard │ │ Tasks    │ │ Workers  │ │ Fault Monitor│   │  │
│  │  │Scheduler │ │Resources │ │Analytics │ │ Logs/Settings│   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Backend (FastAPI + Python)

| Module | Path | Responsibility |
|---|---|---|
| **API Layer** | `backend/app/api/` | REST endpoints for tasks, workers, scheduler, faults, analytics, logs, health |
| **Models** | `backend/app/models/` | SQLAlchemy ORM: `Task`, `Worker`, `Fault`, `SchedulerConfig`, `SystemEvent`, `TaskAttempt` |
| **Services** | `backend/app/services/` | Business logic: task lifecycle, worker management, fault handling, recovery, analytics |
| **Scheduler** | `backend/app/scheduler/` | Priority queue + pluggable strategies (Round Robin, Least Loaded, Resource Aware, Priority Based) |
| **Fault Tolerance** | `backend/app/fault_tolerance/` | Heartbeat monitoring, failure detection, automatic task recovery |
| **WebSocket** | `backend/app/websocket/` | Real-time event broadcast to dashboard clients |
| **Core** | `backend/app/core/` | Config, database engine, Redis gateway, structured logging |

### 2. Worker Containers

Each worker (`worker-01` through `worker-04`) runs `python -m app.workers.demo_worker` inside a Docker container:

- **Registration**: On startup, registers with the backend via `POST /api/workers/register`
- **Heartbeat Loop**: Sends real `psutil` metrics (CPU%, RAM%, uptime) every 2 seconds
- **Assignment Polling**: Polls `GET /api/workers/{id}/assignments` for scheduled tasks
- **Task Execution**: Runs real workloads (CPU burn, memory allocation, I/O wait, mixed)
- **Lifecycle Callbacks**: Reports task start/complete/fail back to the backend
- **Control Loop**: Polls `/api/workers/{id}/control` for simulated failure kill-switch

### 3. Frontend (React + Vite + TanStack)

| Layer | File | Role |
|---|---|---|
| **Live Store** | `src/services/live.ts` | Single source of truth — fetches from REST + subscribes to WebSocket events |
| **API Client** | `src/services/api.ts` | Typed Axios layer with snake_case → camelCase mappers |
| **WebSocket** | `src/services/websocket.ts` | Auto-reconnecting WS client for `/ws/dashboard` |
| **Hooks** | `src/hooks/useSystem.ts` | React hook exposing live cluster state |
| **Pages** | `src/routes/_shell.*.tsx` | Dashboard, Tasks, Workers, Scheduler, Resources, Faults, Analytics, Logs, Settings |

---

## Data Flow

```
┌──────────┐  heartbeat + metrics   ┌──────────┐  events    ┌──────────┐
│  Worker   │ ────────────────────▶  │ Backend  │ ─────────▶ │ Frontend │
│ Container │  poll assignments     │  (API)   │  REST/WS   │  (React) │
│           │ ◀──────────────────── │          │ ◀───────── │          │
└──────────┘  task start/complete   └──────────┘  queries   └──────────┘
                                         │
                                    ┌────┴────┐
                                    │         │
                                ┌───▼──┐  ┌──▼───┐
                                │Postgres│ │Redis │
                                │(state) │ │(queue)│
                                └────────┘ └──────┘
```

1. **Task Submission** → Frontend `POST /api/tasks` → Backend creates task → enqueues in Redis sorted set (by priority score)
2. **Scheduling** → Scheduler engine dequeues → selects worker via strategy → assigns task → records `TaskAttempt`
3. **Execution** → Worker polls assignments → starts task → reports completion/failure
4. **Fault Detection** → Failure detector scans for stale heartbeats → marks worker FAILED → recovers tasks → requeues
5. **Real-time Updates** → All events broadcast via WebSocket → Frontend live store refreshes

---

## Scheduling Algorithms

| Algorithm | Strategy | Selection Logic |
|---|---|---|
| **Round Robin** | `round_robin.py` | Cycles through eligible workers sequentially |
| **Least Loaded** | `least_loaded.py` | Picks worker with fewest active tasks |
| **Resource Aware** | `resource_aware.py` | Scores by available CPU + memory headroom (default) |
| **Priority Based** | `priority.py` | Weights worker reliability + resource fit for critical tasks |

All strategies implement `SchedulerStrategy` (abstract base) with `score()` and `select_worker()` methods. Swappable at runtime via the Settings page or `PUT /api/scheduler/algorithm`.

---

## Fault Tolerance Flow

```
Worker heartbeat timeout (>6s)
        │
        ▼
Failure Detector marks worker FAILED
        │
        ▼
Fault record created (FaultType.HEARTBEAT_TIMEOUT)
        │
        ▼
Recovery Service: find all RUNNING/SCHEDULED tasks on failed worker
        │
        ▼
Each task: mark attempt FAILED → check retry budget (max_retries=3)
        │
    ┌───┴────┐
    ▼        ▼
 Retries   Exhausted
remaining   retries
    │        │
    ▼        ▼
 Requeue   Mark task
 to Redis  permanently
 (RETRYING) FAILED
    │
    ▼
Scheduler picks up → assigns to healthy worker → task resumes
```

**Simulate Failure**: `POST /api/workers/{id}/simulate-failure` pauses the worker's heartbeat, letting the detector trigger real fault recovery.

---

## Database Schema (PostgreSQL)

| Table | Key Columns | Purpose |
|---|---|---|
| `tasks` | task_id, name, priority, status, cpu_required, memory_required, assigned_worker_id, retry_count | Task lifecycle |
| `workers` | worker_id, hostname, status, cpu_capacity, cpu_usage, memory_capacity, memory_usage, last_heartbeat | Worker state |
| `faults` | fault_id, worker_id, fault_type, severity, status, affected_tasks, recovery_time | Fault history |
| `task_attempts` | task_id, worker_id, attempt_number, status, execution_time | Execution audit trail |
| `system_events` | event_type, component, level, message, event_metadata | System log / timeline |
| `scheduler_config` | algorithm, tasks_scheduled, successful/rejected assignments, total_scheduling_latency | Scheduler metrics |

---

## Redis Usage

| Key Pattern | Data Structure | Purpose |
|---|---|---|
| `taskflow:queue:pending` | Sorted Set (score = priority weight) | Priority queue for pending tasks |
| `taskflow:worker:{id}` | String (JSON) | Cached worker state for fast reads |
| `taskflow:heartbeat:{id}` | String (TTL 60s) | Heartbeat liveness marker |
| `taskflow:locks:task:{id}` | String (NX, TTL 30s) | Distributed lock preventing duplicate scheduling |
| `taskflow:worker:{id}:paused` | String | Kill-switch for simulated failures |
| `taskflow:events` | Pub/Sub channel | Real-time event broadcast |

---

## Container Network

All containers communicate on `taskflow-network` (Docker bridge). Service discovery uses Docker DNS:

| Service | Internal Hostname | Exposed Port |
|---|---|---|
| PostgreSQL | `postgres` | 5432 |
| Redis | `redis` | 6379 |
| Backend API | `backend` | 8000 |
| Frontend | `frontend` | 3000 |
| Workers | `worker-01` .. `worker-04` | (internal only) |
