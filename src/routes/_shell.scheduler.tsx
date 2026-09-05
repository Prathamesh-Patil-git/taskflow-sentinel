import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, Cpu, Gauge, Layers, Timer } from "lucide-react";
import { motion } from "motion/react";
import { PageHeader } from "@/components/clay/PageHeader";
import { ClayCard, ClaySectionHeader } from "@/components/clay/ClayCard";
import { MetricCard } from "@/components/clay/MetricCard";
import { CircularGauge } from "@/components/clay/CircularGauge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSystem } from "@/hooks/useSystem";
import { updateAlgorithm } from "@/services/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SchedulingAlgorithm } from "@/types";

export const Route = createFileRoute("/_shell/scheduler")({
  head: () => ({
    meta: [
      { title: "Scheduler Control Center — TaskFlow" },
      {
        name: "description",
        content:
          "Tune the scheduling algorithm and inspect placement decisions, queue depth, scheduling latency and efficiency in real time.",
      },
      { property: "og:title", content: "Scheduler Control Center — TaskFlow" },
      {
        property: "og:description",
        content: "Resource-aware placement decisions and scheduler performance metrics.",
      },
    ],
  }),
  component: SchedulerPage,
});

const ALGORITHMS: { value: SchedulingAlgorithm; label: string; blurb: string }[] = [
  { value: "round-robin", label: "Round Robin", blurb: "Even rotation across all healthy nodes." },
  { value: "least-loaded", label: "Least Loaded", blurb: "Places work on the least busy node." },
  { value: "resource-aware", label: "Resource Aware", blurb: "Scores CPU, memory and locality." },
  { value: "priority-based", label: "Priority Based", blurb: "Critical work preempts the queue." },
];

function SchedulerPage() {
  const { scheduler } = useSystem();
  const active = ALGORITHMS.find((a) => a.value === scheduler.algorithm);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduler Control Center"
        subtitle="Placement policy, queue pressure and the reasoning behind every assignment."
        actions={
          <Select
            value={scheduler.algorithm}
            onValueChange={(v) => void updateAlgorithm(v as SchedulingAlgorithm)}
          >
            <SelectTrigger className="clay h-11 w-56 rounded-full border-0" aria-label="Scheduling algorithm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {ALGORITHMS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          index={0}
          label="Scheduling Rate"
          value={`${scheduler.schedulingRate}/sec`}
          icon={Cpu}
          change={3.1}
        />
        <MetricCard
          index={1}
          label="Avg Scheduling Latency"
          value={`${scheduler.averageLatency} ms`}
          icon={Timer}
          tone="info"
          change={-5.2}
        />
        <MetricCard
          index={2}
          label="Queue Depth"
          value={formatNumber(scheduler.queueDepth)}
          icon={Layers}
          tone="warning"
          change={2.4}
        />
        <MetricCard
          index={3}
          label="Scheduling Efficiency"
          value={`${scheduler.efficiency}%`}
          icon={Gauge}
          tone="success"
          change={1.6}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ClayCard className="flex flex-col items-center justify-center">
          <CircularGauge value={scheduler.efficiency} label="Efficiency" tone="primary" />
          <p className="mt-3 text-center text-sm font-semibold">{active?.label}</p>
          <p className="text-center text-xs text-muted-foreground">{active?.blurb}</p>
        </ClayCard>

        <ClayCard className="lg:col-span-2">
          <ClaySectionHeader
            title="Policy Options"
            description="Switching policy takes effect on the next scheduling cycle."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {ALGORITHMS.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => void updateAlgorithm(a.value)}
                className={cn(
                  "rounded-2xl px-4 py-3 text-left transition-all",
                  a.value === scheduler.algorithm
                    ? "clay text-primary"
                    : "clay-inset text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={a.value === scheduler.algorithm}
              >
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="mt-0.5 text-xs">{a.blurb}</p>
              </button>
            ))}
          </div>
        </ClayCard>
      </div>

      <ClayCard>
        <ClaySectionHeader
          title="Scheduling Decisions"
          description="How the scheduler scored each candidate node for recent placements."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {scheduler.decisions.slice(0, 4).map((d, i) => {
            const best = Math.max(...d.scores.map((s) => s.score), 1);
            return (
              <motion.div
                key={`${d.taskId}-${d.at}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="clay-inset p-4"
              >
                <p className="font-mono text-xs font-semibold">{d.taskId}</p>
                <p className="text-sm font-medium">{d.taskName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Requirements: {d.cpuRequired} CPU · {d.memoryRequired} GB RAM
                </p>
                <ArrowDown className="my-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <ul className="space-y-1.5">
                  {d.scores.map((s) => (
                    <li key={s.workerId} className="flex items-center gap-3">
                      <span className="w-20 font-mono text-[11px] text-muted-foreground">
                        {s.workerId}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full transition-all duration-700",
                            s.workerId === d.selectedWorkerId ? "bg-primary" : "bg-border",
                          )}
                          style={{ width: `${(s.score / best) * 100}%` }}
                        />
                      </span>
                      <span className="w-8 text-right text-xs font-semibold tabular-nums">
                        {s.score}
                      </span>
                    </li>
                  ))}
                </ul>
                <ArrowDown className="my-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <p className="clay inline-block px-3 py-1.5 text-xs font-semibold text-primary">
                  Selected: {d.selectedWorkerId}
                </p>
              </motion.div>
            );
          })}
        </div>
      </ClayCard>
    </div>
  );
}
