import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CircularGauge, toneForValue } from "./CircularGauge";
import { TaskStatusBadge, WorkerStatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { formatUptime, timeAgo } from "@/lib/format";
import type { Task, Worker } from "@/types";

export function WorkerDetailDrawer({
  worker,
  tasks,
  open,
  onOpenChange,
  onSimulateFailure,
}: {
  worker: Worker | null;
  tasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSimulateFailure?: (worker: Worker) => void;
}) {
  const assigned = worker ? tasks.filter((t) => t.workerId === worker.id).slice(0, 8) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {worker ? (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle className="flex flex-wrap items-center gap-3 font-display">
                <span className="font-mono uppercase">{worker.id}</span>
                <WorkerStatusBadge status={worker.status} />
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {worker.region} · {worker.cpuCapacity} vCPU · {worker.memoryCapacity} GB RAM
              </p>
            </SheetHeader>

            <div className="space-y-6 p-4">
              <div className="flex flex-wrap items-center justify-around gap-4">
                <CircularGauge
                  value={worker.cpuUsage}
                  label="CPU"
                  size={132}
                  thickness={12}
                  tone={toneForValue(worker.cpuUsage)}
                />
                <CircularGauge
                  value={worker.memoryUsage}
                  label="Memory"
                  size={132}
                  thickness={12}
                  tone={toneForValue(worker.memoryUsage)}
                />
                <CircularGauge
                  value={worker.reliability}
                  label="Reliability"
                  size={132}
                  thickness={12}
                  tone="success"
                />
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <Field label="Active tasks">{worker.activeTasks}</Field>
                <Field label="Uptime">{formatUptime(worker.uptime)}</Field>
                <Field label="Last heartbeat">{timeAgo(worker.lastHeartbeat)}</Field>
                <Field label="Status">{worker.status}</Field>
              </dl>

              <section>
                <h3 className="mb-3 text-sm font-semibold">Assigned tasks</h3>
                {assigned.length ? (
                  <ul className="space-y-2">
                    {assigned.map((t) => (
                      <li key={t.id} className="clay-inset flex items-center justify-between px-4 py-2.5">
                        <span className="font-mono text-xs">{t.id}</span>
                        <span className="truncate px-3 text-sm text-muted-foreground">{t.name}</span>
                        <TaskStatusBadge status={t.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No tasks currently assigned.</p>
                )}
              </section>

              {onSimulateFailure && worker.status !== "failed" ? (
                <Button
                  variant="destructive"
                  className="clay-press w-full rounded-full"
                  onClick={() => onSimulateFailure(worker)}
                >
                  Simulate failure on {worker.id}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="clay-inset px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium capitalize text-foreground">{children}</dd>
    </div>
  );
}
