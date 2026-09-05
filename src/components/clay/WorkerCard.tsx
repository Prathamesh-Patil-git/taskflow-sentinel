import { MoreVertical, Activity, Cpu, HardDrive } from "lucide-react";
import { motion } from "motion/react";
import { CircularGauge, toneForValue } from "./CircularGauge";
import { WorkerStatusBadge } from "./StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatUptime, timeAgo } from "@/lib/format";
import type { Worker } from "@/types";

export function WorkerCard({
  worker,
  index = 0,
  onInspect,
  onSimulateFailure,
  onRecoverWorker,
}: {
  worker: Worker;
  index?: number;
  onInspect?: (worker: Worker) => void;
  onSimulateFailure?: (worker: Worker) => void;
  onRecoverWorker?: (worker: Worker) => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className="clay clay-hover p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onInspect?.(worker)}
          className="text-left"
          aria-label={`Open details for ${worker.name}`}
        >
          <p className="font-mono text-sm font-semibold uppercase text-foreground">{worker.id}</p>
          <p className="text-xs text-muted-foreground">{worker.region}</p>
        </button>
        <div className="flex items-center gap-1">
          <WorkerStatusBadge status={worker.status} />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="clay-press rounded-full p-1.5 text-muted-foreground hover:text-foreground"
              aria-label={`Actions for ${worker.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onClick={() => onInspect?.(worker)}>View details</DropdownMenuItem>
              {worker.status !== "failed" && worker.status !== "offline" && (
                <DropdownMenuItem onClick={() => onSimulateFailure?.(worker)}>
                  Simulate failure
                </DropdownMenuItem>
              )}
              {(worker.status === "failed" || worker.status === "offline") && onRecoverWorker && (
                <DropdownMenuItem onClick={() => onRecoverWorker?.(worker)}>
                  Recover worker
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-around">
        <CircularGauge
          value={worker.cpuUsage}
          label="CPU"
          size={78}
          thickness={8}
          compact
          tone={toneForValue(worker.cpuUsage)}
        />
        <CircularGauge
          value={worker.memoryUsage}
          label="RAM"
          size={78}
          thickness={8}
          compact
          tone={toneForValue(worker.memoryUsage)}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat icon={Activity} label="Tasks" value={String(worker.activeTasks)} />
        <Stat icon={Cpu} label="Uptime" value={formatUptime(worker.uptime)} />
        <Stat icon={HardDrive} label="Heartbeat" value={timeAgo(worker.lastHeartbeat)} />
      </div>
    </motion.article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="clay-inset px-2 py-2">
      <Icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
