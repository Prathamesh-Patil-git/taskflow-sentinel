import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, CheckCircle2, Timer, Zap } from "lucide-react";
import { PageHeader } from "@/components/clay/PageHeader";
import { ClayCard, ClaySectionHeader } from "@/components/clay/ClayCard";
import { MetricCard } from "@/components/clay/MetricCard";
import { CircularGauge, toneForValue } from "@/components/clay/CircularGauge";
import {
  AreaSeriesChart,
  BarSeriesChart,
  LineSeriesChart,
  LegendPills,
} from "@/components/clay/PerformanceChart";
import { useSystem, useSummary } from "@/hooks/useSystem";
import { useAlgorithmComparison, useAnalyticsOverview } from "@/hooks/useApi";
import { formatClock, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_shell/analytics")({
  head: () => ({
    meta: [
      { title: "Cluster Analytics — TaskFlow" },
      {
        name: "description",
        content:
          "Throughput, success and failure rates, execution and queue times, worker workload distribution and scheduling algorithm comparison.",
      },
      { property: "og:title", content: "Cluster Analytics — TaskFlow" },
      {
        property: "og:description",
        content: "Performance analytics across tasks, workers and scheduling policies.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const ALGO_SERIES = [
  { key: "completion", label: "Avg completion (s)", color: "var(--primary)" },
  { key: "cpu", label: "CPU utilization (%)", color: "var(--info)" },
  { key: "failure", label: "Failure rate (%)", color: "var(--destructive)" },
  { key: "latency", label: "Sched. latency (ms)", color: "var(--warning)" },
];


const THROUGHPUT_SERIES = [{ key: "throughput", label: "Tasks/min", color: "var(--primary)" }];
const OUTCOME_SERIES = [
  { key: "completed", label: "Completed", color: "var(--success)" },
  { key: "failed", label: "Failed", color: "var(--destructive)" },
];

function AnalyticsPage() {
  const { series, workers, tasks } = useSystem();
  const summary = useSummary();
  const { data: overview } = useAnalyticsOverview();
  const { data: comparison } = useAlgorithmComparison();

  const algoData = (comparison ?? []).map((row: Record<string, any>) => ({
    label: String(row["algorithm"] ?? "")
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    completion: Math.round(row["average_execution_time"] ?? 0),
    cpu: Math.round(row["cpu_utilization"] ?? 0),
    failure: Math.round((row["failure_rate"] ?? 0) * 10) / 10,
    latency: Math.round(row["average_latency"] ?? 0),
  }));

  const chart = useMemo(
    () =>
      series.slice(-45).map((p) => ({
        label: formatClock(p.t).slice(0, 5),
        throughput: p.throughput,
        completed: p.completed,
        failed: p.failed,
        cpu: p.cpu,
        memory: p.memory,
      })),
    [series],
  );

  const workload = workers.map((w) => ({
    label: w.id.replace("worker-", "W"),
    tasks: w.activeTasks,
  }));

  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const successRate = completed + failed ? (completed / (completed + failed)) * 100 : 98.7;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cluster Analytics"
        subtitle="Throughput, reliability and scheduling policy performance over time."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard index={0} label="Throughput" value={`${formatNumber(summary.throughput)} /min`} icon={Zap} change={summary.trends.throughput} />
        <MetricCard
          index={1}
          label="Scheduling Latency"
          value={`${Math.round((overview?.["average_scheduling_latency"] ?? 0) * 1000)} ms`}
          icon={Timer}
          tone="info"
        />
        <MetricCard
          index={2}
          label="Success Rate"
          value={`${(overview?.["success_rate"] ?? successRate).toFixed(1)}%`}
          icon={CheckCircle2}
          tone="success"
        />
        <MetricCard
          index={3}
          label="Avg Recovery Time"
          value={`${(overview?.["average_recovery_time"] ?? 0).toFixed(1)} sec`}
          icon={Activity}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClayCard className="flex justify-center">
          <CircularGauge value={Math.round(overview?.["success_rate"] ?? successRate)} label="Success" tone="success" caption="Completed vs failed" />
        </ClayCard>
        <ClayCard className="flex justify-center">
          <CircularGauge value={summary.cpuUtilization} label="CPU" tone={toneForValue(summary.cpuUtilization)} caption="Fleet average" />
        </ClayCard>
        <ClayCard className="flex justify-center">
          <CircularGauge value={summary.memoryUtilization} label="Memory" tone={toneForValue(summary.memoryUtilization)} caption="Fleet average" />
        </ClayCard>
        <ClayCard className="flex justify-center">
          <CircularGauge
            value={Math.round(overview?.["worker_availability"] ?? 0)}
            label="Availability"
            tone="success"
            caption="Workers reporting heartbeats"
          />
        </ClayCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ClayCard>
          <ClaySectionHeader title="Task Throughput" description="Completed tasks per minute" />
          <AreaSeriesChart data={chart} series={THROUGHPUT_SERIES} height={280} />
        </ClayCard>
        <ClayCard>
          <ClaySectionHeader title="Success vs Failure" description="Outcome mix over time" />
          <LegendPills series={OUTCOME_SERIES} />
          <div className="mt-3">
            <AreaSeriesChart data={chart} series={OUTCOME_SERIES} height={250} />
          </div>
        </ClayCard>
        <ClayCard>
          <ClaySectionHeader title="Resource Utilization" description="CPU and memory trends" />
          <LineSeriesChart
            data={chart}
            series={[
              { key: "cpu", label: "CPU %", color: "var(--primary)" },
              { key: "memory", label: "Memory %", color: "var(--info)" },
            ]}
            height={280}
          />
        </ClayCard>
        <ClayCard>
          <ClaySectionHeader title="Worker Workload Distribution" description="Active tasks per node" />
          <BarSeriesChart
            data={workload}
            series={[{ key: "tasks", label: "Active tasks", color: "var(--primary)" }]}
            height={280}
          />
        </ClayCard>
      </div>

      <ClayCard>
        <ClaySectionHeader
          title="Scheduling Algorithm Comparison"
          description="Measured from recorded scheduling decisions in this cluster."
        />
        {algoData.length ? (
          <BarSeriesChart data={algoData} series={ALGO_SERIES} height={320} showLegend />
        ) : (
          <p className="clay-inset rounded-2xl p-6 text-sm text-muted-foreground">
            No scheduling decisions recorded yet — submit tasks to compare algorithms.
          </p>
        )}
      </ClayCard>
    </div>
  );
}
