import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus, WorkerStatus, LogLevel } from "@/types";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
  primary: "bg-primary/15 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

const TASK_TONE: Record<TaskStatus, Tone> = {
  pending: "neutral",
  running: "info",
  completed: "success",
  failed: "danger",
  retrying: "warning",
};

const WORKER_TONE: Record<WorkerStatus, Tone> = {
  online: "success",
  overloaded: "warning",
  failed: "danger",
  offline: "neutral",
};

const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

const LEVEL_TONE: Record<LogLevel, Tone> = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "danger",
  CRITICAL: "danger",
};

export function StatusBadge({
  label,
  tone = "neutral",
  dot = false,
  pulse = false,
  className,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex h-1.5 w-1.5">
          {pulse ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          ) : null}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {label}
    </span>
  );
}

export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => (
  <StatusBadge label={status} tone={TASK_TONE[status]} dot pulse={status === "running"} />
);

export const WorkerStatusBadge = ({ status }: { status: WorkerStatus }) => (
  <StatusBadge label={status} tone={WORKER_TONE[status]} dot pulse={status === "online"} />
);

export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => (
  <StatusBadge label={priority} tone={PRIORITY_TONE[priority]} />
);

export const LogLevelBadge = ({ level }: { level: LogLevel }) => (
  <StatusBadge label={level} tone={LEVEL_TONE[level]} />
);
