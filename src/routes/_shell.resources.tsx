import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/clay/PageHeader";
import { ClayCard, ClaySectionHeader } from "@/components/clay/ClayCard";
import { CircularGauge, toneForValue } from "@/components/clay/CircularGauge";
import { AreaSeriesChart, BarSeriesChart, LegendPills } from "@/components/clay/PerformanceChart";
import { WorkerStatusBadge } from "@/components/clay/StatusBadge";
import { useSystem } from "@/hooks/useSystem";
import { useResources } from "@/hooks/useApi";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/resources")({
  head: () => ({
    meta: [
      { title: "Resource Allocation — TaskFlow" },
      {
        name: "description",
        content:
          "Cluster-wide CPU, memory, storage and network allocation with per-worker capacity, usage and load distribution.",
      },
      { property: "og:title", content: "Resource Allocation — TaskFlow" },
      {
        property: "og:description",
        content: "Track how compute capacity is allocated across the worker fleet.",
      },
    ],
  }),
  component: ResourcesPage,
});

const UTIL_SERIES = [
  { key: "cpu", label: "CPU %", color: "var(--primary)" },
  { key: "memory", label: "Memory %", color: "var(--info)" },
];

function ResourcesPage() {
  const { workers, series } = useSystem();
  const live = workers.filter((w) => w.status !== "offline" && w.status !== "failed");
  const { data: resources } = useResources();
  const cpu = Math.round(
    resources?.["cpu_utilization"] ??
      live.reduce((a, w) => a + w.cpuUsage, 0) / Math.max(1, live.length),
  );
  const memory = Math.round(
    resources?.["memory_utilization"] ??
      live.reduce((a, w) => a + w.memoryUsage, 0) / Math.max(1, live.length),
  );
  const storage = Math.round(resources?.["storage_utilization"] ?? 0);
  const network = Math.round(resources?.["network_utilization"] ?? 0);

  const utilData = useMemo(
    () =>
      series.slice(-40).map((p) => ({
        label: formatClock(p.t).slice(0, 5),
        cpu: p.cpu,
        memory: p.memory,
      })),
    [series],
  );

  const distribution = workers.map((w) => ({ label: w.id.replace("worker-", "W"), tasks: w.activeTasks }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resource Allocation"
        subtitle="How compute, memory, storage and network capacity are distributed across the fleet."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClayCard className="flex justify-center">
          <CircularGauge value={cpu} label="CPU" tone={toneForValue(cpu)} caption="Allocated vCPU" />
        </ClayCard>
        <ClayCard className="flex justify-center">
          <CircularGauge value={memory} label="Memory" tone={toneForValue(memory)} caption="Allocated RAM" />
        </ClayCard>
        <ClayCard className="flex justify-center">
          <CircularGauge value={storage} label="Storage" tone={toneForValue(storage)} caption="Persistent volumes" />
        </ClayCard>
        <ClayCard className="flex justify-center">
          <CircularGauge value={network} label="Network" tone={toneForValue(network)} caption="Egress saturation" />
        </ClayCard>
      </div>

      <ClayCard>
        <ClaySectionHeader
          title="Worker Resource Table"
          description="Capacity versus live consumption for every node."
        />
        <div className="scrollbar-clay overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 pb-1">Worker</th>
                <th className="px-4 pb-1">CPU capacity</th>
                <th className="px-4 pb-1">CPU used</th>
                <th className="px-4 pb-1">RAM capacity</th>
                <th className="px-4 pb-1">RAM used</th>
                <th className="px-4 pb-1">Tasks</th>
                <th className="px-4 pb-1">Load</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => {
                const load = Math.round((w.cpuUsage * 0.6 + w.memoryUsage * 0.4) as number);
                return (
                  <tr key={w.id} className="clay [&>td]:bg-card [&>td]:px-4 [&>td]:py-3">
                    <td className="rounded-l-2xl">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{w.id}</span>
                        <WorkerStatusBadge status={w.status} />
                      </div>
                    </td>
                    <td className="tabular-nums text-muted-foreground">{w.cpuCapacity} vCPU</td>
                    <td className="w-40">
                      <MiniBar value={w.cpuUsage} />
                    </td>
                    <td className="tabular-nums text-muted-foreground">{w.memoryCapacity} GB</td>
                    <td className="w-40">
                      <MiniBar value={w.memoryUsage} />
                    </td>
                    <td className="tabular-nums">{w.activeTasks}</td>
                    <td className="rounded-r-2xl">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          load > 85 ? "text-destructive" : load > 70 ? "text-warning" : "text-success",
                        )}
                      >
                        {load}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ClayCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ClayCard>
          <ClaySectionHeader title="Utilization Over Time" description="Cluster CPU and memory" />
          <LegendPills series={UTIL_SERIES} />
          <div className="mt-3">
            <AreaSeriesChart data={utilData} series={UTIL_SERIES} height={280} />
          </div>
        </ClayCard>
        <ClayCard>
          <ClaySectionHeader title="Task Distribution" description="Active tasks per worker" />
          <BarSeriesChart
            data={distribution}
            series={[{ key: "tasks", label: "Active tasks", color: "var(--primary)" }]}
            height={280}
          />
        </ClayCard>
      </div>
    </div>
  );
}

function MiniBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "block h-full rounded-full transition-all duration-700",
            value > 85 ? "bg-destructive" : value > 70 ? "bg-warning" : "bg-success",
          )}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{value}%</span>
    </span>
  );
}
