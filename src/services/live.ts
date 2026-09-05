/**
 * Live cluster store.
 *
 * Single source of truth for the UI: it pulls real state from the FastAPI
 * backend (REST) and refreshes on WebSocket events pushed by the scheduler,
 * failure detector and workers. No values are generated in the browser.
 */
import type {
  DashboardSummary,
  Fault,
  LogEntry,
  SchedulerState,
  SchedulingAlgorithm,
  SeriesPoint,
  SystemNotification,
  SystemSnapshot,
  Task,
  Worker,
} from "@/types";
import {
  fetchDashboard,
  fetchFaults,
  fetchLogs,
  fetchScheduler,
  fetchTasks,
  mapFault,
  mapLog,
  mapScheduler,
  mapTask,
  mapWorker,
} from "./api";
import { clusterSocket, type ClusterEvent } from "./websocket";

const EMPTY_SCHEDULER: SchedulerState = {
  algorithm: "resource-aware",
  queueDepth: 0,
  schedulingRate: 0,
  averageLatency: 0,
  efficiency: 0,
  decisions: [],
};

const EMPTY_SUMMARY: DashboardSummary = {
  totalTasks: 0,
  runningTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  activeWorkers: 0,
  throughput: 0,
  cpuUtilization: 0,
  memoryUtilization: 0,
  systemHealth: 0,
  schedulerEfficiency: 0,
  trends: {
    totalTasks: 0,
    runningTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    activeWorkers: 0,
    throughput: 0,
  },
  sparklines: {
    totalTasks: [],
    runningTasks: [],
    completedTasks: [],
    failedTasks: [],
    activeWorkers: [],
    throughput: [],
  },
};

let snapshot: SystemSnapshot = {
  workers: [],
  tasks: [],
  scheduler: EMPTY_SCHEDULER,
  faults: [],
  logs: [],
  series: [],
  notifications: [],
  updatedAt: 0,
};

let summary: DashboardSummary = EMPTY_SUMMARY;
let health: Record<string, string> = {};
let connected = false;

const listeners = new Set<() => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeSocket: (() => void) | null = null;
let refreshQueued: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function trend(values: number[]): number {
  if (values.length < 2) return 0;
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  if (!first) return last ? 100 : 0;
  return Math.round(((last - first) / first) * 1000) / 10;
}

function spark(values: number[], length = 16) {
  const slice = values.slice(-length);
  return slice;
}

function buildSummaryFromApi(payload: Record<string, any>, series: SeriesPoint[]): DashboardSummary {
  return {
    totalTasks: payload["total_tasks"] ?? 0,
    runningTasks: payload["running_tasks"] ?? 0,
    completedTasks: payload["completed_tasks"] ?? 0,
    failedTasks: payload["failed_tasks"] ?? 0,
    activeWorkers: payload["active_workers"] ?? 0,
    throughput: payload["throughput"] ?? 0,
    cpuUtilization: Math.round(payload["cpu_utilization"] ?? 0),
    memoryUtilization: Math.round(payload["memory_utilization"] ?? 0),
    systemHealth: Math.round(payload["system_health"] ?? 0),
    schedulerEfficiency: Math.round(payload["scheduler_efficiency"] ?? 0),
    trends: {
      totalTasks: trend(series.map((p) => p.submitted)),
      runningTasks: trend(series.map((p) => p.running)),
      completedTasks: trend(series.map((p) => p.completed)),
      failedTasks: trend(series.map((p) => p.failed)),
      activeWorkers: 0,
      throughput: trend(series.map((p) => p.throughput)),
    },
    sparklines: {
      totalTasks: spark(series.map((p) => p.submitted)),
      runningTasks: spark(series.map((p) => p.running)),
      completedTasks: spark(series.map((p) => p.completed)),
      failedTasks: spark(series.map((p) => p.failed)),
      activeWorkers: spark(series.map(() => payload["active_workers"] ?? 0)),
      throughput: spark(series.map((p) => p.throughput)),
    },
  };
}

export async function refresh(): Promise<void> {
  try {
    const [dashboard, tasks, scheduler, faults, logs] = await Promise.all([
      fetchDashboard(),
      fetchTasks(),
      fetchScheduler(),
      fetchFaults(),
      fetchLogs(),
    ]);

    const series: SeriesPoint[] = (dashboard["series"] ?? []).map((p: any) => ({
      t: p.t,
      submitted: p.submitted ?? 0,
      running: p.running ?? 0,
      completed: p.completed ?? 0,
      failed: p.failed ?? 0,
      throughput: p.throughput ?? 0,
      cpu: p.cpu ?? 0,
      memory: p.memory ?? 0,
    }));

    const workers: Worker[] = (dashboard["workers"] ?? []).map(mapWorker);
    summary = buildSummaryFromApi(dashboard, series);
    health = dashboard["health"] ?? {};
    connected = true;

    snapshot = {
      workers,
      tasks: (tasks ?? []).map(mapTask) as Task[],
      scheduler: mapScheduler(scheduler),
      faults: (faults?.["faults"] ?? []).map(mapFault) as Fault[],
      logs: (logs ?? []).map(mapLog) as LogEntry[],
      series,
      notifications: snapshot.notifications,
      updatedAt: Date.now(),
    };
    emit();
  } catch {
    connected = false;
    emit();
  }
}

function queueRefresh(delay = 350) {
  if (refreshQueued) return;
  refreshQueued = setTimeout(() => {
    refreshQueued = null;
    void refresh();
  }, delay);
}

const NOTIFIABLE: Record<string, { tone: SystemNotification["tone"]; title: string }> = {
  WORKER_FAILED: { tone: "danger", title: "Worker failed" },
  WORKER_RECOVERED: { tone: "success", title: "Worker recovered" },
  WORKER_REGISTERED: { tone: "info", title: "Worker registered" },
  WORKER_HEARTBEAT_SUSPENDED: { tone: "warning", title: "Failure injected" },
  TASK_RETRYING: { tone: "warning", title: "Task retrying" },
  TASK_FAILED: { tone: "danger", title: "Task failed" },
  SCHEDULER_ALGORITHM_CHANGED: { tone: "info", title: "Scheduler updated" },
};

function onEvent(event: ClusterEvent) {
  const meta = NOTIFIABLE[event.event];
  if (meta) {
    pushNotification({ title: meta.title, detail: event.message, tone: meta.tone });
  }
  if (event.event !== "WORKER_HEARTBEAT" && event.event !== "PING") queueRefresh();
  else queueRefresh(1200);
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refresh();
    pollTimer = setInterval(() => void refresh(), 5000);
    unsubscribeSocket = clusterSocket.subscribe(onEvent);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      unsubscribeSocket?.();
      unsubscribeSocket = null;
    }
  };
}

export function getState(): SystemSnapshot {
  return snapshot;
}

export function getSummary(): DashboardSummary {
  return summary;
}

export function getHealth(): Record<string, string> {
  return health;
}

export function isConnected(): boolean {
  return connected;
}

export function markNotificationsRead() {
  if (!snapshot.notifications.some((n) => !n.read)) return;
  snapshot = {
    ...snapshot,
    notifications: snapshot.notifications.map((n) => ({ ...n, read: true })),
  };
  emit();
}

export function pushNotification(n: Omit<SystemNotification, "id" | "at" | "read">) {
  const notification: SystemNotification = {
    ...n,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    read: false,
  };
  snapshot = {
    ...snapshot,
    notifications: [notification, ...snapshot.notifications].slice(0, 40),
  };
  emit();
}

export function setLocalAlgorithm(algorithm: SchedulingAlgorithm) {
  snapshot = { ...snapshot, scheduler: { ...snapshot.scheduler, algorithm } };
  emit();
}
