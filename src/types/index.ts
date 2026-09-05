export type WorkerStatus = "online" | "overloaded" | "failed" | "offline";

export interface Worker {
  id: string;
  name: string;
  status: WorkerStatus;
  cpuCapacity: number;
  cpuUsage: number;
  memoryCapacity: number;
  memoryUsage: number;
  activeTasks: number;
  uptime: number; // seconds
  lastHeartbeat: number; // epoch ms
  reliability: number; // 0-100
  region: string;
}

export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "retrying";

export interface Task {
  id: string;
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  cpuRequired: number;
  memoryRequired: number;
  workerId: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  duration: number; // seconds
  retryCount: number;
  logs: { at: number; level: LogLevel; message: string }[];
}

export type SchedulingAlgorithm =
  | "round-robin"
  | "least-loaded"
  | "resource-aware"
  | "priority-based";

export interface SchedulerState {
  algorithm: SchedulingAlgorithm;
  queueDepth: number;
  schedulingRate: number;
  averageLatency: number;
  efficiency: number;
  decisions: SchedulingDecision[];
}

export interface SchedulingDecision {
  taskId: string;
  taskName: string;
  cpuRequired: number;
  memoryRequired: number;
  scores: { workerId: string; score: number }[];
  selectedWorkerId: string;
  at: number;
}

export type FaultSeverity = "low" | "medium" | "high" | "critical";

export interface Fault {
  id: string;
  workerId: string;
  type: string;
  severity: FaultSeverity;
  timestamp: number;
  status: "active" | "recovering" | "recovered";
  affectedTasks: number;
  recoveryTime: number; // seconds
  events: { at: number; message: string; tone: "info" | "warning" | "danger" | "success" }[];
}

export type LogLevel = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  component: string;
  workerId: string | null;
  message: string;
}

export interface SeriesPoint {
  t: number;
  submitted: number;
  running: number;
  completed: number;
  failed: number;
  throughput: number;
  cpu: number;
  memory: number;
}

export interface SystemNotification {
  id: string;
  title: string;
  detail: string;
  tone: "info" | "warning" | "danger" | "success";
  at: number;
  read: boolean;
}

export interface SystemSnapshot {
  workers: Worker[];
  tasks: Task[];
  scheduler: SchedulerState;
  faults: Fault[];
  logs: LogEntry[];
  series: SeriesPoint[];
  notifications: SystemNotification[];
  updatedAt: number;
}

export interface DashboardSummary {
  totalTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeWorkers: number;
  throughput: number;
  cpuUtilization: number;
  memoryUtilization: number;
  systemHealth: number;
  schedulerEfficiency: number;
  trends: Record<string, number>;
  sparklines: Record<string, number[]>;
}
