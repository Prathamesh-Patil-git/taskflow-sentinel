import { motion } from "motion/react";
import { Server, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Worker } from "@/types";

const STATUS_RING: Record<Worker["status"], string> = {
  online: "text-success",
  overloaded: "text-warning",
  failed: "text-destructive",
  offline: "text-muted-foreground",
};

const STATUS_DOT: Record<Worker["status"], string> = {
  online: "bg-success",
  overloaded: "bg-warning",
  failed: "bg-destructive",
  offline: "bg-muted-foreground",
};

/** Scheduler → worker fan-out with subtly animated connection lines. */
export function ClusterTopology({ workers }: { workers: Worker[] }) {
  const nodes = workers.slice(0, 6);
  return (
    <div className="flex flex-col items-center">
      <div className="clay-inset flex items-center gap-2 px-5 py-3">
        <Network className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="font-display text-sm font-semibold">Scheduler</span>
      </div>

      <svg className="h-16 w-full max-w-3xl" viewBox="0 0 600 64" aria-hidden="true">
        {nodes.map((w, i) => {
          const x = 40 + (i * 520) / Math.max(1, nodes.length - 1);
          return (
            <g key={w.id}>
              <path
                d={`M300 0 C300 34, ${x} 26, ${x} 64`}
                fill="none"
                stroke="var(--border)"
                strokeWidth={2}
              />
              <motion.circle
                r={3}
                fill={
                  w.status === "failed"
                    ? "var(--destructive)"
                    : w.status === "overloaded"
                      ? "var(--warning)"
                      : "var(--primary)"
                }
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
              >
                <animateMotion
                  dur="2.4s"
                  repeatCount="indefinite"
                  begin={`${i * 0.3}s`}
                  path={`M300 0 C300 34, ${x} 26, ${x} 64`}
                />
              </motion.circle>
            </g>
          );
        })}
      </svg>

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {nodes.map((w) => (
          <div key={w.id} className="clay p-3 text-center">
            <Server className={cn("mx-auto h-4 w-4", STATUS_RING[w.status])} aria-hidden="true" />
            <p className="mt-1.5 font-mono text-[11px] font-semibold">{w.id}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[w.status])} />
              {w.status}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{w.activeTasks} tasks</p>
          </div>
        ))}
      </div>
    </div>
  );
}
