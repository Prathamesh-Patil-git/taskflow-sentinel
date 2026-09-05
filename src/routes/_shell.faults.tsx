import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ShieldAlert, ShieldCheck, Timer, RotateCcw, ArrowDown } from "lucide-react";
import { PageHeader } from "@/components/clay/PageHeader";
import { ClayCard, ClaySectionHeader } from "@/components/clay/ClayCard";
import { MetricCard } from "@/components/clay/MetricCard";
import { Timeline } from "@/components/clay/Timeline";
import { FailureSimulationModal } from "@/components/clay/FailureSimulationModal";
import { StatusBadge } from "@/components/clay/StatusBadge";
import { EmptyState } from "@/components/clay/StateViews";
import { Button } from "@/components/ui/button";
import { useSystem } from "@/hooks/useSystem";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/faults")({
  head: () => ({
    meta: [
      { title: "Fault Monitor — TaskFlow" },
      {
        name: "description",
        content:
          "Detect worker failures, watch tasks requeue and reassign automatically, and measure recovery rate and recovery time.",
      },
      { property: "og:title", content: "Fault Monitor — TaskFlow" },
      {
        property: "og:description",
        content: "Live fault detection, retry pipeline and automatic recovery timeline.",
      },
    ],
  }),
  component: FaultsPage,
});

const STAGES = [
  "Worker failure",
  "Failure detected",
  "Tasks interrupted",
  "Retry queue",
  "Scheduler",
  "Reassigned",
  "Recovered",
];

function FaultsPage() {
  const { faults, workers, tasks } = useSystem();
  const [simOpen, setSimOpen] = useState(false);

  const active = faults.filter((f) => f.status !== "recovered");
  const today = faults.filter((f) => Date.now() - f.timestamp < 24 * 3600_000);
  const recovered = today.filter((f) => f.status === "recovered");
  const avgRecovery = recovered.length
    ? (recovered.reduce((a, f) => a + f.recoveryTime, 0) / recovered.length).toFixed(1)
    : "0.0";
  const retrying = tasks.filter((t) => t.status === "retrying").length;
  const activeStage = active.length ? Math.min(5, active[0]!.events.length) : 6;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fault Monitor"
        subtitle="Failure detection, task recovery and cluster resilience in real time."
        actions={
          <Button
            variant="destructive"
            className="clay-press rounded-full"
            onClick={() => setSimOpen(true)}
          >
            <ShieldAlert className="mr-2 h-4 w-4" aria-hidden="true" />
            Simulate failure
          </Button>
        }
      />

      <ClayCard className={cn(active.length ? "ring-2 ring-destructive/40" : "")}>
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={cn(
              "clay-inset rounded-full p-4",
              active.length ? "text-destructive" : "text-success",
            )}
          >
            {active.length ? (
              <ShieldAlert className="h-7 w-7" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            )}
          </span>
          <div>
            <p className="font-display text-2xl font-semibold">
              {active.length} Active {active.length === 1 ? "Failure" : "Failures"}
            </p>
            <p className="text-sm text-muted-foreground">
              {active.length
                ? "Recovery pipeline in progress — tasks are being reassigned."
                : "Cluster is fully redundant. All workers reporting healthy heartbeats."}
            </p>
          </div>
          <StatusBadge
            className="ml-auto"
            label={active.length ? "recovering" : "stable"}
            tone={active.length ? "danger" : "success"}
            dot
            pulse
          />
        </div>
      </ClayCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard index={0} label="Failures Today" value={String(today.length)} icon={ShieldAlert} tone="danger" />
        <MetricCard index={1} label="Recovered Automatically" value={String(recovered.length)} icon={ShieldCheck} tone="success" />
        <MetricCard
          index={2}
          label="Recovery Rate"
          value={`${today.length ? Math.round((recovered.length / today.length) * 100) : 100}%`}
          icon={RotateCcw}
          tone="info"
        />
        <MetricCard index={3} label="Avg Recovery Time" value={`${avgRecovery} sec`} icon={Timer} tone="warning" />
      </div>

      <ClayCard>
        <ClaySectionHeader
          title="Fault Tolerance Pipeline"
          description={`${retrying} task${retrying === 1 ? "" : "s"} currently in the retry queue.`}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {STAGES.map((stage, i) => (
            <motion.div
              key={stage}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-xs font-semibold",
                  i <= activeStage
                    ? i === activeStage && active.length
                      ? "clay text-destructive"
                      : "clay text-success"
                    : "clay-inset text-muted-foreground",
                )}
              >
                {stage}
              </span>
              {i < STAGES.length - 1 ? (
                <ArrowDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" aria-hidden="true" />
              ) : null}
            </motion.div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workers.slice(0, 8).map((w) => (
            <div
              key={w.id}
              className={cn(
                "clay-inset px-4 py-3 text-sm",
                w.status === "failed" && "text-destructive",
              )}
            >
              <p className="font-mono text-xs font-semibold">{w.id}</p>
              <p className="text-xs capitalize text-muted-foreground">{w.status}</p>
              <p className="mt-1 text-xs">{w.activeTasks} tasks</p>
            </div>
          ))}
        </div>
      </ClayCard>

      <ClayCard>
        <ClaySectionHeader title="Fault Event Timeline" description="Newest incidents first" />
        {faults.length === 0 ? (
          <EmptyState title="No faults recorded" description="Incidents appear here as soon as a node degrades." />
        ) : (
          <div className="space-y-6">
            {faults.slice(0, 4).map((f) => (
              <div key={f.id} className="clay-inset p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs font-semibold">{f.id}</span>
                  <span className="text-sm font-medium">
                    {f.workerId} · {f.type}
                  </span>
                  <StatusBadge
                    label={f.status}
                    tone={f.status === "recovered" ? "success" : f.status === "active" ? "danger" : "warning"}
                  />
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(f.timestamp)} · {f.affectedTasks} tasks affected
                  </span>
                </div>
                <Timeline items={f.events} />
              </div>
            ))}
          </div>
        )}
      </ClayCard>

      <FailureSimulationModal workers={workers} open={simOpen} onOpenChange={setSimOpen} />
    </div>
  );
}
