# TaskFlow — Distributed Task Scheduling & Resource Allocation Dashboard

A premium, clay-styled monitoring and control dashboard for a distributed task scheduler, running on realistic simulated live data so it can later be wired to a real backend without redesign.

## Look and feel

Claymorphism / soft neumorphism: puffy rounded cards (20–28px), soft outer shadows plus a faint inner highlight, minimal borders, generous spacing. Light mode on a warm-cool neutral (#F4F6FA), dark mode on deep charcoal with the same raised clay feel — not an inversion. Indigo/violet as the accent; emerald, amber, red and blue used only for status, alerts, charts and active navigation. Modern geometric-grotesk headings with a neutral body face, monospace for logs and IDs.

## Screens

1. **Login** — TaskFlow logo, tagline "Intelligent scheduling. Resilient infrastructure.", animated abstract node-network background, clay login card. Entering credentials goes to the dashboard (demo-only, no real accounts).
2. **Dashboard** — "Distributed System Overview" with live indicator, last-updated time and refresh; 6 KPI cards with sparklines and trend; four large animated circular gauges (CPU, memory, system health, scheduler efficiency); System Health card with four component indicators; Live Task Execution area chart with 1H/6H/24H/7D selector; Worker Cluster clay cards with mini CPU/RAM gauges, uptime and heartbeat; animated scheduler→workers cluster topology.
3. **Tasks** — Task Queue with tabs (All/Pending/Running/Completed/Failed/Retrying), search, filters, sortable columns, pagination, clay status and priority badges; row click opens a task detail drawer with lifecycle timeline and execution log.
4. **Workers** — full worker grid plus a worker detail drawer (resources, assigned tasks, heartbeat history).
5. **Scheduler** — "Scheduler Control Center": algorithm selector (Round Robin, Least Loaded, Resource Aware, Priority Based), rate/latency/queue-depth/efficiency metrics, and a visual scheduling-decision flow with per-worker scores and the selected winner.
6. **Resources** — four allocation gauges, worker resource table with mini bars, CPU/memory-over-time and task-distribution charts.
7. **Fault Monitor** — active-failure status card, today's failure/recovery metrics, fault event timeline, and an animated fault-tolerance flow. "Simulate Failure" marks a worker failed, requeues and reassigns its tasks, writes timeline events, updates metrics and raises a recovery toast.
8. **Analytics** — success/failure, throughput, latency, utilization and workload-distribution charts plus a scheduling-algorithm comparison chart, with gauge-based performance metric cards.
9. **Logs** — monospace log viewer with level and worker filters, search, date range, auto-scroll toggle.
10. **Settings** — theme toggle, refresh interval, notification and threshold preferences.

Persistent clay sidebar on desktop (logo, "TaskFlow / Distributed Scheduler", grouped nav with raised active pill, Settings + System Status at the bottom); drawer on mobile. Top bar carries page title, global search, health indicator, notifications dropdown and profile menu.

## Behaviour

A simulation layer ticks every few seconds: utilization drifts, task counts move, new tasks arrive, heartbeats refresh, throughput changes. Every page has loading skeletons, empty states and error states with retry. Hover elevation, animated gauge fill, chart entry animations and page transitions — subtle, never busy. Keyboard-navigable, labelled controls, tooltips on unfamiliar icons.

## Technical notes

- Stack as shipped: React + TypeScript + Vite + Tailwind v4 with shadcn/ui, Lucide icons, Recharts, Framer Motion, TanStack Query. Routing uses TanStack Router (the project's fixed router) rather than React Router; route files map 1:1 to the pages above.
- All data flows through a service layer in `src/services/` exposing `getDashboard`, `getWorkers`, `getWorker(id)`, `getTasks`, `getTask(id)`, `createTask`, `getScheduler`, `getResources`, `getFaults`, `getLogs`, plus a subscribe hook standing in for `/ws/dashboard`. Mock implementations live behind the same signatures so a FastAPI/PostgreSQL/Redis backend can replace them by swapping the transport only.
- Shared types in `src/types/`: Worker, Task, Scheduler, Fault, LogEntry, matching the fields in the brief.
- Reusable components: MetricCard, CircularGauge, WorkerCard, StatusBadge, TaskTable, PerformanceChart, HealthIndicator, Timeline, ResourceGauge, NotificationPanel, FailureSimulationModal, PageHeader, Sidebar, TopNavigation.
- Clay elevation, gauge gradients and semantic status colors are design tokens in `src/styles.css`, applied through component variants — no hardcoded colors.
- Per-page titles and descriptions for search and sharing.

## Not included

No real backend, database or authentication — login is a demo gate and all numbers are simulated. Say the word and I can add real accounts and persistence afterwards.
