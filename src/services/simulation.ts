/**
 * In-memory simulation of the distributed cluster.
 *
 * This module is the ONLY place that fabricates data. Everything the UI reads
 * goes through `src/services/api.ts`, so swapping this for FastAPI REST calls
 * plus a `/ws/dashboard` socket does not require touching components.
 */
import type {
  Fault,
  LogEntry,
  LogLevel,
  SchedulerState,
  SchedulingDecision,
  SeriesPoint,
  SystemNotification,
  SystemSnapshot,
  Task,
  TaskPriority,
  TaskStatus,
  Worker,
} from "@/types";

const TASK_NAMES = [
  "Image Processing",
  "Video Transcode",
  "ETL Ingest",
  "Model Training",
  "Batch Inference",
  "Log Compaction",
  "Report Generation",
  "Data Backup",
  "Index Rebuild",
  "Fraud Scoring",
  "Email Digest",
  "Cache Warmup",
];

const COMPONENTS = ["scheduler", "worker-agent", "queue", "database", "heartbeat", "allocator"];
const REGIONS = ["us-east-1", "us-west-2", "eu-central-1", "ap-south-1"];

let seed = 20260905;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function range(min: number, max: number) {
  return min + rnd() * (max - min);
}
function pick<T>(items: T[]): T {
  return items[Math.floor(rnd() * items.length)];
}
function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

let taskCounter = 10240;
let logCounter = 0;
let faultCounter = 0;

function makeWorker(index: number): Worker {
  const cpuCapacity = pick([8, 16, 16, 32]);
  const memoryCapacity = pick([16, 32, 32, 64]);
  return {
    id: `worker-${String(index + 1).padStart(2, "0")}`,
    name: `Worker ${String(index + 1).padStart(2, "0")}`,
    status: "online",
    cpuCapacity,
    cpuUsage: Math.round(range(28, 76)),
    memoryCapacity,
    memoryUsage: Math.round(range(30, 72)),
    activeTasks: Math.round(range(4, 16)),
    uptime: Math.round(range(3600 * 12, 3600 * 24 * 9)),
    lastHeartbeat: Date.now() - Math.round(range(500, 4000)),
    reliability: Math.round(range(96, 100)),
    region: REGIONS[index % REGIONS.length],
  };
}

function makeTask(workers: Worker[], status?: TaskStatus): Task {
  taskCounter += 1;
  const priority = pick<TaskPriority>(["critical", "high", "medium", "medium", "low", "high"]);
  const finalStatus =
    status ?? pick<TaskStatus>(["running", "running", "completed", "pending", "failed", "retrying"]);
  const now = Date.now();
  const createdAt = now - Math.round(range(30_000, 6 * 3600_000));
  const started = finalStatus === "pending" ? null : createdAt + Math.round(range(400, 9000));
  const duration =
    finalStatus === "pending" ? 0 : Math.round(range(4, 320) * (priority === "critical" ? 0.6 : 1));
  const online = workers.filter((w) => w.status !== "failed" && w.status !== "offline");
  return {
    id: `T-${taskCounter}`,
    name: pick(TASK_NAMES),
    priority,
    status: finalStatus,
    cpuRequired: pick([1, 2, 2, 4, 4, 8]),
    memoryRequired: pick([1, 2, 2, 4, 8]),
    workerId: finalStatus === "pending" ? null : (pick(online.length ? online : workers)?.id ?? null),
    createdAt,
    startedAt: started,
    completedAt: finalStatus === "completed" || finalStatus === "failed" ? now : null,
    duration,
    retryCount: finalStatus === "retrying" ? Math.round(range(1, 3)) : 0,
    logs: [
      { at: createdAt, level: "INFO" as LogLevel, message: "Task submitted to queue" },
      { at: createdAt + 800, level: "INFO" as LogLevel, message: "Resource requirements validated" },
    ],
  };
}

function makeLog(
  level: LogLevel,
  component: string,
  workerId: string | null,
  message: string,
  timestamp = Date.now(),
): LogEntry {
  logCounter += 1;
  return { id: `log-${logCounter}`, timestamp, level, component, workerId, message };
}

function buildSeries(): SeriesPoint[] {
  const now = Date.now();
  const points: SeriesPoint[] = [];
  for (let i = 59; i >= 0; i--) {
    points.push({
      t: now - i * 60_000,
      submitted: Math.round(range(38, 72)),
      running: Math.round(range(26, 58)),
      completed: Math.round(range(30, 66)),
      failed: Math.round(range(0, 5)),
      throughput: Math.round(range(980, 1420)),
      cpu: Math.round(range(52, 84)),
      memory: Math.round(range(48, 76)),
    });
  }
  return points;
}

function initialState(): SystemSnapshot {
  const workers = Array.from({ length: 8 }, (_, i) => makeWorker(i));
  workers[5].status = "overloaded";
  workers[5].cpuUsage = 91;
  workers[7].status = "offline";
  workers[7].cpuUsage = 0;
  workers[7].memoryUsage = 0;
  workers[7].activeTasks = 0;

  const tasks = Array.from({ length: 64 }, () => makeTask(workers));
  const scheduler: SchedulerState = {
    algorithm: "resource-aware",
    queueDepth: 128,
    schedulingRate: 21,
    averageLatency: 42,
    efficiency: 87,
    decisions: [],
  };
  const logs: LogEntry[] = [];
  for (let i = 0; i < 60; i++) {
    const level = pick<LogLevel>(["INFO", "INFO", "INFO", "WARNING", "ERROR", "INFO"]);
    logs.push(
      makeLog(
        level,
        pick(COMPONENTS),
        pick(workers).id,
        pick([
          "Heartbeat received within SLA window",
          "Task dispatched to worker pool",
          "Resource allocation committed",
          "Queue depth threshold evaluated",
          "Checkpoint written to durable storage",
          "Retry budget consumed for task",
          "Connection pool saturation detected",
        ]),
        Date.now() - Math.round(range(1000, 3600_000)),
      ),
    );
  }
  logs.sort((a, b) => b.timestamp - a.timestamp);

  const state: SystemSnapshot = {
    workers,
    tasks,
    scheduler,
    faults: seedFaults(workers),
    logs,
    series: buildSeries(),
    notifications: [
      {
        id: "n-1",
        title: "Worker-06 CPU above 85%",
        detail: "Sustained high utilization for 4 minutes.",
        tone: "warning",
        at: Date.now() - 180_000,
        read: false,
      },
      {
        id: "n-2",
        title: "Worker-03 recovered successfully",
        detail: "All interrupted tasks were reassigned.",
        tone: "success",
        at: Date.now() - 900_000,
        read: false,
      },
      {
        id: "n-3",
        title: "12 tasks were reassigned",
        detail: "Rebalanced after a heartbeat timeout.",
        tone: "info",
        at: Date.now() - 1_500_000,
        read: true,
      },
    ],
    updatedAt: Date.now(),
  };
  for (let i = 0; i < 4; i++) state.scheduler.decisions.push(makeDecision(state));
  return state;
}

function seedFaults(workers: Worker[]): Fault[] {
  const base = Date.now() - 3 * 3600_000;
  return Array.from({ length: 4 }, (_, i) => {
    faultCounter += 1;
    const w = workers[(i * 2) % workers.length];
    const at = base + i * 2400_000;
    return {
      id: `F-${1000 + faultCounter}`,
      workerId: w.id,
      type: pick(["heartbeat timeout", "process crash", "memory exhaustion", "network partition"]),
      severity: pick<FaultSeverityAlias>(["medium", "high", "critical", "low"]),
      timestamp: at,
      status: "recovered" as const,
      affectedTasks: Math.round(range(2, 9)),
      recoveryTime: Number(range(2.1, 4.8).toFixed(1)),
      events: [
        { at, message: `${w.id} heartbeat timeout`, tone: "warning" as const },
        { at: at + 2000, message: `${w.id} marked FAILED`, tone: "danger" as const },
        { at: at + 3000, message: "Interrupted tasks detected", tone: "warning" as const },
        { at: at + 4000, message: "Tasks requeued to retry queue", tone: "info" as const },
        { at: at + 6000, message: "Tasks reassigned to healthy workers", tone: "info" as const },
        { at: at + 8000, message: "Recovery completed", tone: "success" as const },
      ],
    };
  });
}

type FaultSeverityAlias = Fault["severity"];

function makeDecision(state: SystemSnapshot): SchedulingDecision {
  taskCounter += 1;
  const healthy = state.workers.filter((w) => w.status === "online" || w.status === "overloaded");
  const scores = healthy.slice(0, 4).map((w) => ({
    workerId: w.id,
    score: Math.round(clamp(100 - w.cpuUsage * 0.5 - w.memoryUsage * 0.3 + range(0, 18))),
  }));
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a), scores[0]);
  return {
    taskId: `T-${taskCounter}`,
    taskName: pick(TASK_NAMES),
    cpuRequired: pick([1, 2, 4, 8]),
    memoryRequired: pick([1, 2, 4]),
    scores,
    selectedWorkerId: best?.workerId ?? healthy[0]?.id ?? "worker-01",
    at: Date.now(),
  };
}

let state: SystemSnapshot = initialState();
const listeners = new Set<() => void>();

function emit() {
  state = { ...state, updatedAt: Date.now() };
  listeners.forEach((l) => l());
}

export function getState(): SystemSnapshot {
  return state;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  startTicking();
  return () => {
    listeners.delete(listener);
  };
}

function drift(value: number, amount: number, min = 2, max = 98) {
  return Math.round(clamp(value + range(-amount, amount), min, max));
}

function tick() {
  const now = Date.now();

  state.workers = state.workers.map((w) => {
    if (w.status === "failed" || w.status === "offline") return w;
    const cpuUsage = drift(w.cpuUsage, 7, 8, 99);
    const memoryUsage = drift(w.memoryUsage, 5, 10, 97);
    return {
      ...w,
      cpuUsage,
      memoryUsage,
      status: cpuUsage > 88 ? "overloaded" : "online",
      activeTasks: Math.max(0, w.activeTasks + Math.round(range(-2, 2))),
      uptime: w.uptime + 3,
      lastHeartbeat: now - Math.round(range(200, 2500)),
    };
  });

  // progress tasks
  state.tasks = state.tasks.map((t) => {
    if (t.status === "running") {
      const roll = rnd();
      if (roll > 0.93) {
        return { ...t, status: "completed", completedAt: now, duration: t.duration + 3 };
      }
      if (roll < 0.02) {
        return { ...t, status: "failed", completedAt: now };
      }
      return { ...t, duration: t.duration + 3 };
    }
    if (t.status === "retrying" && rnd() > 0.85) {
      return { ...t, status: "running", startedAt: now };
    }
    if (t.status === "pending" && rnd() > 0.8) {
      const healthy = state.workers.filter((w) => w.status === "online");
      return {
        ...t,
        status: "running",
        startedAt: now,
        workerId: healthy.length ? pick(healthy).id : t.workerId,
      };
    }
    return t;
  });

  // new arrivals
  const arrivals = Math.round(range(0, 3));
  for (let i = 0; i < arrivals; i++) {
    state.tasks = [makeTask(state.workers, "pending"), ...state.tasks].slice(0, 240);
  }

  const running = state.tasks.filter((t) => t.status === "running").length;
  const cpu = Math.round(avg(state.workers.filter(isLive).map((w) => w.cpuUsage)));
  const memory = Math.round(avg(state.workers.filter(isLive).map((w) => w.memoryUsage)));

  state.series = [
    ...state.series.slice(-119),
    {
      t: now,
      submitted: Math.round(range(38, 72)),
      running,
      completed: Math.round(range(30, 66)),
      failed: Math.round(range(0, 4)),
      throughput: Math.round(range(980, 1420)),
      cpu,
      memory,
    },
  ];

  state.scheduler = {
    ...state.scheduler,
    queueDepth: Math.max(0, state.scheduler.queueDepth + Math.round(range(-14, 14))),
    schedulingRate: Math.round(clamp(state.scheduler.schedulingRate + range(-3, 3), 6, 48)),
    averageLatency: Math.round(clamp(state.scheduler.averageLatency + range(-6, 6), 18, 120)),
    efficiency: Math.round(clamp(state.scheduler.efficiency + range(-2, 2), 62, 99)),
    decisions: [makeDecision(state), ...state.scheduler.decisions].slice(0, 6),
  };

  if (rnd() > 0.55) {
    const w = pick(state.workers);
    state.logs = [
      makeLog(
        rnd() > 0.86 ? (rnd() > 0.5 ? "WARNING" : "ERROR") : "INFO",
        pick(COMPONENTS),
        w.id,
        pick([
          `Heartbeat acknowledged from ${w.id}`,
          `Dispatched task batch to ${w.id}`,
          `CPU utilization at ${w.cpuUsage}% on ${w.id}`,
          "Queue rebalanced across available workers",
          "Checkpoint flushed to durable storage",
          `Retry scheduled with exponential backoff for ${w.id}`,
        ]),
      ),
      ...state.logs,
    ].slice(0, 400);
  }

  emit();
}

function isLive(w: Worker) {
  return w.status === "online" || w.status === "overloaded";
}
function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

let timer: ReturnType<typeof setInterval> | null = null;
function startTicking() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(tick, 3000);
}

export function setAlgorithm(algorithm: SchedulerState["algorithm"]) {
  state.scheduler = { ...state.scheduler, algorithm };
  state.logs = [makeLog("INFO", "scheduler", null, `Scheduling algorithm set to ${algorithm}`), ...state.logs];
  emit();
}

export function markNotificationsRead() {
  state.notifications = state.notifications.map((n) => ({ ...n, read: true }));
  emit();
}

export function pushNotification(n: Omit<SystemNotification, "id" | "at" | "read">) {
  state.notifications = [
    { ...n, id: `n-${Math.random().toString(36).slice(2, 9)}`, at: Date.now(), read: false },
    ...state.notifications,
  ].slice(0, 30);
  emit();
}

/** Simulate a worker failure and the full automatic recovery pipeline. */
export function simulateFailure(workerId: string): Fault {
  const now = Date.now();
  faultCounter += 1;
  const worker = state.workers.find((w) => w.id === workerId);
  const affected = state.tasks.filter((t) => t.workerId === workerId && t.status === "running");

  state.workers = state.workers.map((w) =>
    w.id === workerId ? { ...w, status: "failed", cpuUsage: 0, memoryUsage: 0, activeTasks: 0 } : w,
  );
  state.tasks = state.tasks.map((t) =>
    t.workerId === workerId && t.status === "running"
      ? { ...t, status: "retrying", retryCount: t.retryCount + 1, workerId: null }
      : t,
  );

  const fault: Fault = {
    id: `F-${1000 + faultCounter}`,
    workerId,
    type: "heartbeat timeout",
    severity: "critical",
    timestamp: now,
    status: "active",
    affectedTasks: affected.length,
    recoveryTime: 0,
    events: [
      { at: now, message: `${workerId} heartbeat timeout`, tone: "warning" },
      { at: now + 2000, message: `${workerId} marked FAILED`, tone: "danger" },
      { at: now + 3000, message: `${affected.length} tasks detected as interrupted`, tone: "warning" },
      { at: now + 4000, message: "Tasks requeued into the retry queue", tone: "info" },
    ],
  };
  state.faults = [fault, ...state.faults];
  state.logs = [
    makeLog("CRITICAL", "heartbeat", workerId, `${workerId} missed 3 consecutive heartbeats`),
    makeLog("ERROR", "scheduler", workerId, `${affected.length} running tasks interrupted`),
    ...state.logs,
  ];
  pushNotification({
    title: `${worker?.name ?? workerId} failed`,
    detail: `${affected.length} tasks moved to the retry queue.`,
    tone: "danger",
  });
  emit();

  // recovery pipeline
  setTimeout(() => {
    const healthy = state.workers.filter((w) => w.status === "online");
    state.tasks = state.tasks.map((t) =>
      t.status === "retrying" && !t.workerId && healthy.length
        ? { ...t, status: "running", workerId: pick(healthy).id, startedAt: Date.now() }
        : t,
    );
    state.faults = state.faults.map((f) =>
      f.id === fault.id
        ? {
            ...f,
            status: "recovering",
            events: [
              ...f.events,
              { at: Date.now(), message: "Tasks reassigned to healthy workers", tone: "info" },
            ],
          }
        : f,
    );
    emit();
  }, 2200);

  setTimeout(() => {
    state.workers = state.workers.map((w) =>
      w.id === workerId
        ? { ...w, status: "online", cpuUsage: 24, memoryUsage: 30, uptime: 0, lastHeartbeat: Date.now() }
        : w,
    );
    state.faults = state.faults.map((f) =>
      f.id === fault.id
        ? {
            ...f,
            status: "recovered",
            recoveryTime: Number(((Date.now() - now) / 1000).toFixed(1)),
            events: [...f.events, { at: Date.now(), message: "Recovery completed", tone: "success" }],
          }
        : f,
    );
    state.logs = [
      makeLog("INFO", "scheduler", workerId, `${workerId} rejoined the cluster after recovery`),
      ...state.logs,
    ];
    pushNotification({
      title: `${worker?.name ?? workerId} recovered successfully`,
      detail: `${affected.length} tasks were reassigned and resumed.`,
      tone: "success",
    });
    emit();
  }, 4600);

  return fault;
}
