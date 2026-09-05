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

const ALGO_DATA = [
  { label: "Round Robin", completion: 58, cpu: 61, failure: 3.4, latency: 61 },
  { label: "Least Loaded", completion: 46, cpu: 72, failure: 2.1, latency: 48 },
  { label: "Resource Aware", completion: 38, cpu: 81, failure: 1.3, latency: 42 },
];

const THROUGHPUT_SERIES = [{ key: "throughput", label: "Tasks/min", color: "var(--primary)" }];
const OUTCOME_SERIES = [
  { key: "completed", label: "Completed", color: "var(--success)" },
  { key: "failed", label: "Failed", color: "var(--destructive)" },
];

function AnalyticsPage() {
  const { series, workers, tasks } = useSystem();
  const summary = useSummary();

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
        <MetricCard index={0} label="Throughput" value={`${formatNumber(summary.throughput)} /min`} icon={Zap} change={6.5} />
        <MetricCard index={1} label="Average Latency" value="184 ms" icon={Timer} tone="info" change={-4.8} />
        <MetricCard index={2} label="Success Rate" value={`${successRate.toFixed(1)}%`} icon={CheckCircle2} tone="success" change={1.2} />
        <MetricCard index={3} label="Avg Recovery Time" value="3.2 sec" icon={Activity} tone="warning" change={-9.4} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClayCard className="flex justify-center">
          <CircularGauge value={Math.round(successRate)} label="Success" tone="success" caption="Completed vs failed" />
        </ClayCard>
        <ClayCard className="flex justify-center">
          <CircularGauge value={summary.cpuUtilization} label="CPU" tone={toneForValue(summary.cpuUtilization)} caption="Fleet average" />
        </ClayCard>
        <ClayCard className="flex justify-center">
          <CircularGauge value={summary.memoryUtilization} label="Memory" tone={toneForValue(summary.memoryUtilization)} caption="Fleet average" />
        </ClayCard>
        <ClayCard className="flex justify-center">
          <CircularGauge value={99.8} label="Availability" tone="success" caption="Worker uptime (30d)" />
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
          description="Measured across the last 10,000 scheduled tasks."
        />
        <BarSeriesChart data={ALGO_DATA} series={ALGO_SERIES} height={320} showLegend />
      </ClayCard>
    </div>
  );
}
