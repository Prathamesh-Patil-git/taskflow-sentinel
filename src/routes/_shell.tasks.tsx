import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/clay/PageHeader";
import { ClayCard, ClaySectionHeader } from "@/components/clay/ClayCard";
import { TaskTable } from "@/components/clay/TaskTable";
import { TaskDetailDrawer } from "@/components/clay/TaskDetailDrawer";
import { MetricCard } from "@/components/clay/MetricCard";
import { LoadingState, ErrorState } from "@/components/clay/StateViews";
import { SubmitTaskDialog } from "@/components/clay/SubmitTaskDialog";
import { useSystem, useSummary } from "@/hooks/useSystem";
import { Activity, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { Task } from "@/types";

export const Route = createFileRoute("/_shell/tasks")({
  head: () => ({
    meta: [
      { title: "Task Queue — TaskFlow" },
      {
        name: "description",
        content:
          "Browse, filter and inspect every scheduled task: priority, resource requirements, assigned worker, status and retries.",
      },
      { property: "og:title", content: "Task Queue — TaskFlow" },
      {
        property: "og:description",
        content: "Search, sort and drill into distributed task execution across the cluster.",
      },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const state = useSystem();
  const summary = useSummary();
  const [selected, setSelected] = useState<Task | null>(null);
  const [failed, setFailed] = useState(false);

  const count = (s: Task["status"]) => state.tasks.filter((t) => t.status === s).length;

  if (failed) {
    return (
      <>
        <PageHeader title="Task Queue" subtitle="Every task the scheduler is tracking." />
        <ErrorState onRetry={() => setFailed(false)} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Queue"
        subtitle="Every task the scheduler is tracking, from submission through recovery."
        actions={<SubmitTaskDialog />}
      />

      {state.tasks.length === 0 ? (
        <LoadingState rows={5} label="Loading tasks" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              index={0}
              label="Running"
              value={formatNumber(count("running"))}
              icon={Activity}
              tone="info"
              change={summary.trends.runningTasks}
            />
            <MetricCard
              index={1}
              label="Pending"
              value={formatNumber(count("pending"))}
              icon={Clock}
              tone="warning"

            />
            <MetricCard
              index={2}
              label="Completed"
              value={formatNumber(count("completed"))}
              icon={CheckCircle2}
              tone="success"
              change={summary.trends.completedTasks}
            />
            <MetricCard
              index={3}
              label="Retrying"
              value={formatNumber(count("retrying"))}
              icon={RotateCcw}
              tone="danger"
              change={summary.trends.failedTasks}
            />
          </div>

          <ClayCard>
            <ClaySectionHeader
              title="Task Queue"
              description="Select any row to open the full execution detail."
            />
            <TaskTable tasks={state.tasks} onSelect={setSelected} />
          </ClayCard>
        </>
      )}

      <TaskDetailDrawer
        task={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
