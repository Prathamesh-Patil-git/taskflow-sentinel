import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  Layers,
  RefreshCw,
  Server,
  XCircle,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/clay/PageHeader";
import { MetricCard } from "@/components/clay/MetricCard";
import { CircularGauge, toneForValue } from "@/components/clay/CircularGauge";
import { ClayCard, ClaySectionHeader } from "@/components/clay/ClayCard";
import { HealthIndicator } from "@/components/clay/HealthIndicator";
import { WorkerCard } from "@/components/clay/WorkerCard";
import { ClusterTopology } from "@/components/clay/ClusterTopology";
import { AreaSeriesChart, LegendPills } from "@/components/clay/PerformanceChart";
import { WorkerDetailDrawer } from "@/components/clay/WorkerDetailDrawer";
import { FailureSimulationModal } from "@/components/clay/FailureSimulationModal";
import { LoadingState } from "@/components/clay/StateViews";
import { Button } from "@/components/ui/button";
import { useSystem, useSummary } from "@/hooks/useSystem";
import { formatClock, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Worker } from "@/types";

export const Route = createFileRoute("/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "Distributed System Overview — TaskFlow" },
      {
        name: "description",
        content:
          "Real-time monitoring of tasks, workers, resource utilization and fault recovery across the TaskFlow cluster.",
      },
      { property: "og:title", content: "Distributed System Overview — TaskFlow" },
      {
        property: "og:description",
        content: "Live cluster metrics, worker health and scheduling efficiency in one dashboard.",
      },
    ],
  }),
  component: DashboardPage,
});

const RANGES = ["1H", "6H", "24H", "7D"] as const;
const SERIES = [
  { key: "submitted", label: "Submitted", color: "var(--primary)" },
  { key: "running", label: "Running", color: "var(--info)" },
  { key: "completed", label: "Completed", color: "var(--success)" },
  { key: "failed", label: "Failed", color: "var(--destructive)" },
];

function DashboardPage() {
  const state = useSystem();
  const summary = useSummary();
  const [range, setRange] = useState<(typeof RANGES)[number]>("1H");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [simulateFor, setSimulateFor] = useState<string | undefined>();
  const [simOpen, setSimOpen] = useState(false);

  const points = { "1H": 20, "6H": 40, "24H": 70, "7D": 120 }[range];
  const chartData = useMemo(
    () =>
      state.series.slice(-points).map((p) => ({
        label: formatClock(p.t).slice(0, 5),
        submitted: p.submitted,
        running: p.running,
        completed: p.completed,
        failed: p.failed,
      })),
    [state.series, points],
  );

  const failedWorkers = state.workers.filter((w) => w.status === "failed").length;

  if (refreshing) {
    return (
      <div className="space-y-4">
        <LoadingState rows={4} label="Refreshing cluster metrics" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distributed System Overview"
        subtitle="Real-time monitoring of tasks, workers, resources and fault recovery."
        actions={
          <>
            <span className="clay-inset flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live
            </span>
            <span className="text-xs text-muted-foreground">
              Updated {formatClock(state.updatedAt)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="clay clay-press rounded-full"
              aria-label="Refresh dashboard"
              onClick={() => {
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 700);
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          index={0}
          label="Total Tasks"
          value={formatNumber(summary.totalTasks)}
          icon={Layers}
          change={summary.trends.totalTasks}
          sparkline={summary.sparklines.totalTasks}
        />
        <MetricCard
          index={1}
          label="Running Tasks"
          value={formatNumber(summary.runningTasks)}
          icon={Activity}
          tone="info"
          change={summary.trends.runningTasks}
          sparkline={summary.sparklines.runningTasks}
        />
        <MetricCard
          index={2}
          label="Completed Tasks"
          value={formatNumber(summary.completedTasks)}
          icon={CheckCircle2}
          tone="success"
          change={summary.trends.completedTasks}
          sparkline={summary.sparklines.completedTasks}
        />
        <MetricCard
          index={3}
          label="Failed Tasks"
          value={formatNumber(summary.failedTasks)}
          icon={XCircle}
          tone="danger"
          change={summary.trends.failedTasks}
          sparkline={summary.sparklines.failedTasks}
        />
        <MetricCard
          index={4}
          label="Active Workers"
          value={`${summary.activeWorkers} / ${state.workers.length}`}
          icon={Server}
          tone="primary"
          change={summary.trends.activeWorkers}
          changeCaption="cluster capacity"
          sparkline={summary.sparklines.activeWorkers}
        />
        <MetricCard
          index={5}
          label="Throughput"
          value={`${formatNumber(summary.throughput)}/min`}
          icon={Zap}
          tone="warning"
          change={summary.trends.throughput}
          sparkline={summary.sparklines.throughput}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <ClayCard className="flex flex-col items-center">
          <CircularGauge
            value={summary.cpuUtilization}
            label="CPU"
            tone={toneForValue(summary.cpuUtilization)}
            caption={`Average across ${summary.activeWorkers} workers`}
          />
        </ClayCard>
        <ClayCard className="flex flex-col items-center">
          <CircularGauge
            value={summary.memoryUtilization}
            label="Memory"
            tone={toneForValue(summary.memoryUtilization)}
            caption="Allocated across the cluster"
          />
        </ClayCard>
        <ClayCard className="flex flex-col items-center">
          <CircularGauge
            value={summary.systemHealth}
            label="System health"
            tone={summary.systemHealth >= 90 ? "success" : summary.systemHealth >= 70 ? "warning" : "danger"}
            caption="Composite of workers, queue and storage"
          />
        </ClayCard>
        <ClayCard className="flex flex-col items-center">
          <CircularGauge
            value={summary.schedulerEfficiency}
            label="Scheduler"
            tone="primary"
            caption={`${state.scheduler.algorithm.replace("-", " ")} policy`}
          />
        </ClayCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ClayCard className="lg:col-span-1">
          <ClaySectionHeader title="System Health" description="Component level readiness" />
          <div className="flex items-center gap-4">
            <CircularGauge
              value={summary.systemHealth}
              size={110}
              thickness={11}
              compact
              tone={summary.systemHealth >= 90 ? "success" : "warning"}
            />
            <div>
              <p className="font-display text-sm font-semibold">Overall health</p>
              <p
                className={cn(
                  "mt-1 text-sm font-medium",
                  failedWorkers ? "text-destructive" : "text-success",
                )}
              >
                {failedWorkers ? `${failedWorkers} worker offline` : "All systems operational"}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <HealthIndicator name="Scheduler" state="healthy" detail={`${state.scheduler.schedulingRate} tasks/sec`} />
            <HealthIndicator
              name="Worker Network"
              state={failedWorkers ? "degraded" : "healthy"}
              detail={`${summary.activeWorkers} nodes reporting`}
            />
            <HealthIndicator
              name="Task Queue"
              state={state.scheduler.queueDepth > 220 ? "degraded" : "healthy"}
              detail={`${state.scheduler.queueDepth} queued`}
            />
            <HealthIndicator name="Database" state="healthy" detail="Replication lag 12 ms" />
          </div>
        </ClayCard>

        <ClayCard className="lg:col-span-2">
          <ClaySectionHeader
            title="Live Task Execution"
            description="Submitted, running, completed and failed tasks over time"
            action={
              <div className="clay-inset flex gap-1 rounded-full p-1">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      range === r ? "clay text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={range === r}
                  >
                    {r}
                  </button>
                ))}
              </div>
            }
          />
          <LegendPills series={SERIES} />
          <div className="mt-3">
            <AreaSeriesChart data={chartData} series={SERIES} height={280} />
          </div>
        </ClayCard>
      </div>

      <ClayCard>
        <ClaySectionHeader
          title="Worker Cluster"
          description="Node level utilization and heartbeat freshness"
          action={
            <Button asChild variant="ghost" className="clay clay-press rounded-full text-xs">
              <Link to="/workers">View all workers</Link>
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {state.workers.slice(0, 4).map((w, i) => (
            <WorkerCard
              key={w.id}
              worker={w}
              index={i}
              onInspect={setSelectedWorker}
              onSimulateFailure={(worker) => {
                setSimulateFor(worker.id);
                setSimOpen(true);
              }}
            />
          ))}
        </div>
      </ClayCard>

      <ClayCard>
        <ClaySectionHeader
          title="Cluster Topology"
          description="Scheduler fan-out across worker nodes"
        />
        <ClusterTopology workers={state.workers} />
      </ClayCard>

      <WorkerDetailDrawer
        worker={selectedWorker}
        tasks={state.tasks}
        open={Boolean(selectedWorker)}
        onOpenChange={(open) => !open && setSelectedWorker(null)}
        onSimulateFailure={(w) => {
          setSelectedWorker(null);
          setSimulateFor(w.id);
          setSimOpen(true);
        }}
      />
      <FailureSimulationModal
        workers={state.workers}
        open={simOpen}
        onOpenChange={setSimOpen}
        defaultWorkerId={simulateFor}
      />
    </div>
  );
}
