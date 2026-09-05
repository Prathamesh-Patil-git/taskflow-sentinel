# TaskFlow Sentinel

**Fault-Tolerant Distributed Task Scheduling & Resource Allocation System**

A production-quality real-time monitoring dashboard for a distributed computing platform. It manages tasks, worker nodes, resource allocation, scheduling decisions, failures, retries, and system performance — all backed by real Docker containers running actual workloads.

> **No mock data.** Every metric, heartbeat, and task execution comes from real worker containers reporting via `psutil`. The frontend is 100% API-backed.

---

## Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v20+ with Docker Compose v2)
- Git

### Steps to Run

```bash
# 1. Clone the repository
git clone https://github.com/Prathamesh-Patil-git/taskflow-sentinel.git
cd taskflow-sentinel

# 2. Create the environment file
cp .env.example .env

# 3. Build and start all containers (first run takes ~3-5 min)
docker compose up --build -d

# 4. Wait for all services to be healthy (~30-60 seconds)
docker compose ps

# 5. Open the dashboard
#    Frontend:  http://localhost:3000
#    Backend:   http://localhost:8000
#    API docs:  http://localhost:8000/docs
```

### What Gets Started

| Container | Image | Port | Role |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | Persistent storage (tasks, workers, faults, events) |
| `redis` | `redis:7-alpine` | 6379 | Priority queue, heartbeat cache, pub/sub, distributed locks |
| `backend` | `taskflow-backend` | 8000 | FastAPI REST API + WebSocket + scheduler engine + failure detector |
| `frontend` | `taskflow-frontend` | 3000 | React + Vite dashboard (Claymorphism UI) |
| `worker-01` | `taskflow-worker` | — | Real worker node (psutil metrics, CPU/memory/IO tasks) |
| `worker-02` | `taskflow-worker` | — | Real worker node |
| `worker-03` | `taskflow-worker` | — | Real worker node |
| `worker-04` | `taskflow-worker` | — | Real worker node |

### Useful Commands

```bash
# View all container status
docker compose ps

# Watch backend logs (scheduler + fault detector)
docker compose logs -f backend

# Watch a specific worker
docker compose logs -f worker-01

# Watch all workers
docker compose logs -f worker-01 worker-02 worker-03 worker-04

# Stop everything
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v

# Rebuild after code changes
docker compose up --build -d

# Optional: launch pgAdmin (database explorer)
docker compose --profile tools up -d pgadmin
# Then open http://localhost:5050 (admin@taskflow.local / taskflow)
```

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

### High-Level Overview

```
                    ┌──────────────┐
                    │   Frontend   │ :3000
                    │ React + Vite │
                    └──────┬───────┘
                           │ REST + WebSocket
                    ┌──────▼───────┐
                    │   Backend    │ :8000
                    │   FastAPI    │
                    │  ┌─────────┐ │
                    │  │Scheduler│ │  ◄── 4 algorithms (swappable at runtime)
                    │  │ Engine  │ │
                    │  ├─────────┤ │
                    │  │ Failure │ │  ◄── Heartbeat timeout → auto recovery
                    │  │Detector │ │
                    │  └─────────┘ │
                    └──┬───────┬───┘
                       │       │
                ┌──────▼──┐ ┌──▼──────┐
                │PostgreSQL│ │  Redis  │
                │  :5432   │ │  :6379  │
                └──────────┘ └─────────┘
                       ▲
          ┌────────────┼────────────────┐
    ┌─────▼────┐ ┌─────▼────┐ ┌────▼─────┐ ┌─────▼────┐
    │worker-01 │ │worker-02 │ │worker-03 │ │worker-04 │
    │  psutil  │ │  psutil  │ │  psutil  │ │  psutil  │
    └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, shadcn/ui, Recharts, Framer Motion, TanStack Router + Query |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x (async), Alembic, Pydantic v2 |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 (sorted sets for priority queue, pub/sub for events) |
| Workers | Python + psutil (real OS metrics), httpx (async HTTP) |
| Infra | Docker Compose, multi-container orchestration |

### Scheduling Algorithms

| Algorithm | Strategy |
|---|---|
| **Round Robin** | Cycles through eligible workers sequentially |
| **Least Loaded** | Picks worker with fewest active tasks |
| **Resource Aware** | Scores by available CPU + memory headroom (default) |
| **Priority Based** | Weights worker reliability + resource fit |

Switch algorithms live from the **Settings** or **Scheduler** page.

### Fault Tolerance

1. Worker heartbeat timeout (>6s) → Failure detector marks worker `FAILED`
2. All in-flight tasks on that worker are detected
3. Tasks with retry budget remaining → requeued to Redis → rescheduled to healthy workers
4. Tasks with exhausted retries → marked permanently `FAILED`
5. Fault event recorded with recovery time metrics

**Try it:** Click "Simulate Failure" on any worker card in the dashboard.

---

## Dashboard Pages

| Page | Description |
|---|---|
| **Dashboard** | KPIs, circular gauges (CPU/Memory/Health/Scheduler), live task chart, worker cluster, topology |
| **Tasks** | Full task table with search, filters, status badges, create/cancel/retry actions |
| **Workers** | Worker grid with real-time CPU/RAM gauges, heartbeat freshness, failure simulation |
| **Scheduler** | Algorithm selector, scheduling rate/latency/efficiency metrics, decision audit trail |
| **Resources** | Resource allocation gauges, per-worker utilization table, historical charts |
| **Fault Monitor** | Active failures, recovery metrics, fault timeline, failure simulation modal |
| **Analytics** | Throughput trends, success/failure rates, algorithm comparison, resource analytics |
| **Logs** | Searchable system event log with level/component filtering |
| **Settings** | Backend connection, scheduling defaults, retry policy, alerting toggles |

---

## API Endpoints

Base URL: `http://localhost:8000`

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe (DB, Redis, Scheduler, Detector) |
| `GET` | `/api/dashboard` | Aggregated dashboard summary |
| `GET/POST` | `/api/tasks` | List / create tasks |
| `GET` | `/api/tasks/{id}` | Task detail with attempts + events |
| `POST` | `/api/tasks/{id}/cancel` | Cancel a task |
| `POST` | `/api/tasks/{id}/retry` | Retry a failed task |
| `GET` | `/api/workers` | List all workers |
| `POST` | `/api/workers/register` | Worker self-registration |
| `POST` | `/api/workers/{id}/heartbeat` | Worker heartbeat with metrics |
| `GET` | `/api/workers/{id}/assignments` | Tasks scheduled for a worker |
| `POST` | `/api/workers/{id}/simulate-failure` | Inject a worker failure |
| `POST` | `/api/workers/{id}/recover` | Restore a failed worker |
| `GET` | `/api/scheduler` | Scheduler state + recent decisions |
| `PUT` | `/api/scheduler/algorithm` | Change scheduling algorithm |
| `GET` | `/api/resources` | Cluster resource utilization |
| `GET` | `/api/faults` | Fault history |
| `GET` | `/api/analytics/overview` | Analytics summary |
| `GET` | `/api/logs` | System event log |
| `WS` | `/ws/dashboard` | Real-time event stream |

Full interactive docs at **http://localhost:8000/docs** (Swagger UI).

---

## Environment Variables

See [`.env.example`](.env.example) for all configurable values:

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `taskflow` | Database user |
| `POSTGRES_PASSWORD` | `taskflow` | Database password |
| `HEARTBEAT_INTERVAL` | `2` | Worker heartbeat frequency (seconds) |
| `FAILURE_TIMEOUT` | `6` | Seconds before a silent worker is marked failed |
| `MAX_TASK_RETRIES` | `3` | Maximum automatic retries per task |
| `DEFAULT_SCHEDULING_ALGORITHM` | `RESOURCE_AWARE` | Initial algorithm |
| `WORKER_CONCURRENCY` | `4` | Max parallel tasks per worker |
| `WORKER_CPUS` | `1` | CPU limit per worker container |
| `WORKER_MEMORY_LIMIT` | `1G` | Memory limit per worker container |
| `SEED_HISTORY` | `true` | Seed historical demo data on first boot |

---

## Project Structure

```
taskflow-sentinel/
├── backend/
│   ├── app/
│   │   ├── api/              # REST endpoints
│   │   ├── core/             # Config, DB, Redis, logging
│   │   ├── fault_tolerance/  # Failure detector, heartbeat, recovery
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── scheduler/        # Engine + 4 strategy implementations
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # Business logic layer
│   │   ├── utils/            # Time helpers
│   │   ├── websocket/        # WS connection manager + event emitter
│   │   ├── workers/          # Worker runtime + HTTP client
│   │   ├── main.py           # FastAPI app entry point
│   │   └── seed.py           # Demo data seeder
│   ├── alembic/              # Database migrations
│   ├── tests/                # pytest suite
│   ├── Dockerfile            # Backend + worker image
│   ├── entrypoint.sh         # DB wait → migrate → seed → serve
│   └── requirements.txt
├── src/
│   ├── components/
│   │   ├── clay/             # Claymorphism UI components
│   │   ├── layout/           # Sidebar, TopNav
│   │   └── ui/               # shadcn/ui primitives
│   ├── hooks/                # React hooks (useSystem, useApi)
│   ├── routes/               # TanStack Router pages
│   ├── services/             # API client, live store, WebSocket
│   └── types/                # TypeScript type definitions
├── docker-compose.yml        # Full stack orchestration
├── Dockerfile.frontend       # Bun + Vite dev server
├── ARCHITECTURE.md           # System architecture documentation
├── .env.example              # Environment template
└── package.json
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Backend container keeps restarting | Check `docker compose logs backend` — usually a DB connection issue. Wait for postgres to be healthy first. |
| Workers show as FAILED | Workers need the backend healthy first. Run `docker compose restart worker-01 worker-02 worker-03 worker-04` |
| Port 5432 already in use | Stop local PostgreSQL or change `POSTGRES_PORT` in `.env` |
| Port 3000/8000 already in use | Change `FRONTEND_PORT` or `API_PORT` in `.env` |
| `entrypoint.sh: line X: $'\r': command not found` | Windows line ending issue. The `.gitattributes` file should prevent this. Run `git checkout backend/entrypoint.sh` |
| Frontend shows "connecting..." | Backend may not be ready yet. Check `docker compose ps` — backend should show `(healthy)` |
