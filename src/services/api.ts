/**
 * REST API layer — every call hits the FastAPI backend (VITE_API_URL).
 *
 * Components never call axios directly: they use these typed functions or the
 * live store in ./live.ts. Mappers translate backend payloads (snake_case,
 * uppercase enums) into the UI types used across the app.
 */
import axios from "axios";
import type {
  DashboardSummary,
  Fault,
  FaultSeverity,
  LogEntry,
  SchedulerState,
  SchedulingAlgorithm,
  SystemSnapshot,
  Task,
  TaskPriority,
  TaskStatus,
  Worker,
  WorkerStatus,
} from "@/types";

const BASE_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8000";

export const http = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

// ── mappers ───────────────────────────────────────────────────────────────
const WORKER_STATUS: Record<string, WorkerStatus> = {
  ONLINE: "online",
  BUSY: "online",
  OVERLOADED: "overloaded",
  FAILED: "failed",
  OFFLINE: "offline",
};

const TASK_STATUS: Record<string, TaskStatus> = {
  PENDING: "pending",
  QUEUED: "pending",
  SCHEDULED: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  RETRYING: "retrying",
  CANCELLED: "failed",
};

const SEVERITY: Record<string, FaultSeverity> = {
  INFO: "low",
  WARNING: "medium",
  ERROR: "high",
  CRITICAL: "critical",
};

const FAULT_STATUS: Record<string, Fault["status"]> = {
  DETECTED: "active",
  RECOVERING: "recovering",
  RECOVERED: "recovered",
  UNRESOLVED: "active",
};

export const ALGORITHM_TO_API: Record<SchedulingAlgorithm, string> = {
  "round-robin": "ROUND_ROBIN",
  "least-loaded": "LEAST_LOADED",
  "resource-aware": "RESOURCE_AWARE",
  "priority-based": "PRIORITY_BASED",
};

const ALGORITHM_FROM_API: Record<string, SchedulingAlgorithm> = {
  ROUND_ROBIN: "round-robin",
  LEAST_LOADED: "least-loaded",
  RESOURCE_AWARE: "resource-aware",
  PRIORITY_BASED: "priority-based",
};

const ms = (value: string | null | undefined): number | null =>
  value ? new Date(value).getTime() : null;

export function mapWorker(w: any): Worker {
  return {
    id: w.worker_id,
    name: w.hostname ?? w.worker_id,
    status: WORKER_STATUS[w.status] ?? "offline",
    cpuCapacity: w.cpu_capacity ?? 0,
    cpuUsage: w.cpu_percent ?? 0,
    memoryCapacity: w.memory_capacity ?? 0,
    memoryUsage: w.memory_percent ?? 0,
    activeTasks: w.active_tasks ?? 0,
    uptime: w.uptime_seconds ?? 0,
    lastHeartbeat: ms(w.last_heartbeat) ?? 0,
    reliability: Math.round(w.reliability_score ?? 0),
    region: w.region ?? "local",
  };
}

export function mapTask(t: any): Task {
  const started = ms(t.started_at);
  const finished = ms(t.completed_at) ?? ms(t.failed_at);
  return {
    id: t.task_id,
    name: t.name,
    priority: (t.priority ?? "MEDIUM").toLowerCase() as TaskPriority,
    status: TASK_STATUS[t.status] ?? "pending",
    cpuRequired: t.cpu_required ?? 0,
    memoryRequired: t.memory_required ?? 0,
    workerId: t.assigned_worker_id ?? null,
    createdAt: ms(t.created_at) ?? Date.now(),
    startedAt: started,
    completedAt: finished,
    duration: t.actual_duration ?? t.estimated_duration ?? 0,
    retryCount: t.retry_count ?? 0,
    logs: (t.events ?? []).map((e: any) => ({
      at: e.at,
      level: e.level ?? "INFO",
      message: e.message,
    })),
  };
}

export function mapScheduler(s: any): SchedulerState {
  return {
    algorithm: ALGORITHM_FROM_API[s?.algorithm] ?? "resource-aware",
    queueDepth: s?.queue_depth ?? 0,
    schedulingRate: s?.scheduling_rate ?? 0,
    averageLatency: s?.average_latency ?? 0,
    efficiency: Math.round(s?.efficiency ?? 0),
    decisions: (s?.decisions ?? []).map((d: any) => ({
      taskId: d.task_id,
      taskName: d.task_name,
      cpuRequired: d.cpu_required ?? 0,
      memoryRequired: d.memory_required ?? 0,
      scores: (d.scores ?? []).map((x: any) => ({ workerId: x.worker_id, score: x.score })),
      selectedWorkerId: d.selected_worker_id ?? "",
      at: ms(d.at) ?? Date.now(),
    })),
  };
}

export function mapFault(f: any): Fault {
  return {
    id: f.fault_id,
    workerId: f.worker_id ?? "",
    type: f.fault_type,
    severity: SEVERITY[f.severity] ?? "medium",
    timestamp: ms(f.detected_at) ?? Date.now(),
    status: FAULT_STATUS[f.status] ?? "active",
    affectedTasks: f.affected_tasks ?? 0,
    recoveryTime: f.recovery_time ?? 0,
    events: f.events ?? [],
  };
}

export function mapLog(l: any): LogEntry {
  return {
    id: l.id,
    timestamp: l.timestamp,
    level: l.level,
    component: l.component,
    workerId: l.worker_id ?? null,
    message: l.message,
  };
}

// ── raw fetchers (used by the live store) ─────────────────────────────────
export async function fetchDashboard(): Promise<Record<string, any>> {
  return (await http.get("/api/dashboard")).data;
}

export async function fetchTasks(params?: Record<string, unknown>): Promise<any[]> {
  return (await http.get("/api/tasks", { params })).data;
}

export async function fetchScheduler(): Promise<any> {
  return (await http.get("/api/scheduler")).data;
}

export async function fetchFaults(): Promise<any> {
  return (await http.get("/api/faults")).data;
}

export async function fetchLogs(params?: Record<string, unknown>): Promise<any[]> {
  return (await http.get("/api/logs", { params })).data;
}

// ── typed API surface ─────────────────────────────────────────────────────
export async function getDashboard() {
  const data = await fetchDashboard();
  return data;
}

export async function getHealth() {
  return (await http.get("/health")).data;
}

export async function getWorkers(): Promise<Worker[]> {
  return ((await http.get("/api/workers")).data ?? []).map(mapWorker);
}

export async function getWorker(id: string): Promise<Worker> {
  return mapWorker((await http.get(`/api/workers/${id}`)).data);
}

export async function getTasks(params?: Record<string, unknown>): Promise<Task[]> {
  return (await fetchTasks(params)).map(mapTask);
}

export async function getTask(id: string): Promise<Task> {
  return mapTask((await http.get(`/api/tasks/${id}`)).data);
}

export interface CreateTaskInput {
  name: string;
  description?: string;
  task_type?: string;
  priority?: Uppercase<TaskPriority>;
  cpu_required?: number;
  memory_required?: number;
  estimated_duration?: number;
  max_retries?: number;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return mapTask((await http.post("/api/tasks", input)).data);
}

export async function retryTask(id: string): Promise<Task> {
  return mapTask((await http.post(`/api/tasks/${id}/retry`)).data);
}

export async function cancelTask(id: string): Promise<Task> {
  return mapTask((await http.post(`/api/tasks/${id}/cancel`)).data);
}

export async function getScheduler(): Promise<SchedulerState> {
  return mapScheduler(await fetchScheduler());
}

export async function updateSchedulerAlgorithm(algorithm: SchedulingAlgorithm) {
  const { data } = await http.put("/api/scheduler/algorithm", {
    algorithm: ALGORITHM_TO_API[algorithm],
  });
  return mapScheduler(data);
}

/** Kept for existing call sites. */
export const updateAlgorithm = updateSchedulerAlgorithm;

export async function getResources() {
  return (await http.get("/api/resources")).data;
}

export async function getFaults(): Promise<Fault[]> {
  const data = await fetchFaults();
  return (data?.faults ?? []).map(mapFault);
}

export async function getAnalyticsOverview(): Promise<Record<string, number>> {
  return (await http.get("/api/analytics/overview")).data;
}

export async function getAlgorithmComparison(): Promise<Record<string, any>[]> {
  return (await http.get("/api/analytics/scheduling")).data;
}

export async function getResourceAnalytics(): Promise<Record<string, any>> {
  return (await http.get("/api/analytics/resources")).data;
}

export async function getLogs(params?: Record<string, unknown>): Promise<LogEntry[]> {
  return (await fetchLogs(params)).map(mapLog);
}

export interface SimulationResult {
  mode: "detector" | "immediate";
  workerId: string;
  detectsInSeconds: number;
  affectedTasks: number;
}

/** POST /api/workers/{id}/simulate-failure — stops the real heartbeat. */
export async function simulateWorkerFailure(
  workerId: string,
  mode: "detector" | "immediate" = "detector",
): Promise<SimulationResult> {
  const { data } = await http.post(
    `/api/workers/${workerId}/simulate-failure`,
    {},
    { params: { mode } },
  );
  return {
    mode: data.mode,
    workerId,
    detectsInSeconds: data.detects_in_seconds ?? 0,
    affectedTasks: data.affected_tasks ?? 0,
  };
}

/** Kept for existing call sites. */
export const simulateFailure = simulateWorkerFailure;

export async function recoverWorker(workerId: string): Promise<Worker> {
  return mapWorker((await http.post(`/api/workers/${workerId}/recover`)).data);
}

// ── live store re-exports (WS /ws/dashboard backed) ───────────────────────
import * as store from "./live";

export const live = {
  subscribe: store.subscribe,
  getState: store.getState,
  getSummary: store.getSummary,
  getHealth: store.getHealth,
  isConnected: store.isConnected,
  refresh: store.refresh,
  markNotificationsRead: store.markNotificationsRead,
  pushNotification: store.pushNotification,
};

/** Dashboard summary computed by the backend (kept as a function for call sites). */
export function buildSummary(_state?: SystemSnapshot): DashboardSummary {
  return store.getSummary();
}
