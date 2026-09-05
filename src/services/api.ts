/**
 * API abstraction layer.
 *
 * Every function mirrors the eventual FastAPI endpoint it will call
 * (GET /api/dashboard, GET /api/workers, ...). Today they resolve from the
 * in-memory simulation; swapping in axios/fetch calls keeps the UI untouched.
 */
import * as sim from "./simulation";
import type {
  DashboardSummary,
  Fault,
  LogEntry,
  SchedulerState,
  SchedulingAlgorithm,
  SystemSnapshot,
  Task,
  Worker,
} from "@/types";

const LATENCY = 260;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function sparkline(values: number[], length = 16) {
  const slice = values.slice(-length);
  while (slice.length < length) slice.unshift(slice[0] ?? 0);
  return slice;
}

export function buildSummary(state: SystemSnapshot): DashboardSummary {
  const live = state.workers.filter((w) => w.status === "online" || w.status === "overloaded");
  const cpu = live.length
    ? Math.round(live.reduce((a, w) => a + w.cpuUsage, 0) / live.length)
    : 0;
  const memory = live.length
    ? Math.round(live.reduce((a, w) => a + w.memoryUsage, 0) / live.length)
    : 0;
  const failedWorkers = state.workers.filter((w) => w.status === "failed").length;
  const running = state.tasks.filter((t) => t.status === "running").length;
  const completed = state.tasks.filter((t) => t.status === "completed").length;
  const failed = state.tasks.filter((t) => t.status === "failed").length;
  const latest = state.series[state.series.length - 1];

  const health = Math.round(
    Math.max(
      0,
      100 - failedWorkers * 14 - Math.max(0, cpu - 80) * 0.8 - Math.max(0, memory - 85) * 0.6,
    ),
  );

  return {
    totalTasks: 12_486 + state.tasks.length,
    runningTasks: running,
    completedTasks: 11_402 + completed,
    failedTasks: 86 + failed,
    activeWorkers: live.length,
    throughput: latest?.throughput ?? 1200,
    cpuUtilization: cpu,
    memoryUtilization: memory,
    systemHealth: health,
    schedulerEfficiency: state.scheduler.efficiency,
    trends: {
      totalTasks: 12.8,
      runningTasks: 4.2,
      completedTasks: 9.1,
      failedTasks: -3.4,
      activeWorkers: 0,
      throughput: 6.5,
    },
    sparklines: {
      totalTasks: sparkline(state.series.map((p) => p.submitted)),
      runningTasks: sparkline(state.series.map((p) => p.running)),
      completedTasks: sparkline(state.series.map((p) => p.completed)),
      failedTasks: sparkline(state.series.map((p) => p.failed)),
      activeWorkers: sparkline(state.series.map(() => live.length)),
      throughput: sparkline(state.series.map((p) => p.throughput)),
    },
  };
}

/** GET /api/dashboard */
export async function getDashboard() {
  const state = sim.getState();
  return delay({ summary: buildSummary(state), series: state.series, workers: state.workers });
}

/** GET /api/workers */
export async function getWorkers(): Promise<Worker[]> {
  return delay(sim.getState().workers);
}

/** GET /api/workers/:id */
export async function getWorker(id: string): Promise<Worker | undefined> {
  return delay(sim.getState().workers.find((w) => w.id === id));
}

/** GET /api/tasks */
export async function getTasks(): Promise<Task[]> {
  return delay(sim.getState().tasks);
}

/** GET /api/tasks/:id */
export async function getTask(id: string): Promise<Task | undefined> {
  return delay(sim.getState().tasks.find((t) => t.id === id));
}

/** GET /api/scheduler */
export async function getScheduler(): Promise<SchedulerState> {
  return delay(sim.getState().scheduler);
}

/** PATCH /api/scheduler */
export async function updateAlgorithm(algorithm: SchedulingAlgorithm) {
  sim.setAlgorithm(algorithm);
  return delay(sim.getState().scheduler, 120);
}

/** GET /api/resources */
export async function getResources() {
  const state = sim.getState();
  return delay({ workers: state.workers, series: state.series });
}

/** GET /api/faults */
export async function getFaults(): Promise<Fault[]> {
  return delay(sim.getState().faults);
}

/** GET /api/logs */
export async function getLogs(): Promise<LogEntry[]> {
  return delay(sim.getState().logs);
}

/** POST /api/faults/simulate */
export async function simulateFailure(workerId: string) {
  return sim.simulateFailure(workerId);
}

/** WS /ws/dashboard */
export const live = {
  subscribe: sim.subscribe,
  getState: sim.getState,
  markNotificationsRead: sim.markNotificationsRead,
};
