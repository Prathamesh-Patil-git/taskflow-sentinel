import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PriorityBadge, TaskStatusBadge } from "./StatusBadge";
import { formatDateTime, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

const LIFECYCLE = ["Submitted", "Queued", "Scheduled", "Running", "Completed"] as const;

function stageIndex(task: Task) {
  if (task.status === "pending") return 1;
  if (task.status === "retrying") return 2;
  if (task.status === "running") return 3;
  return 4;
}

export function TaskDetailDrawer({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {task ? (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle className="flex flex-wrap items-center gap-3 font-display">
                <span className="font-mono">Task {task.id}</span>
                <TaskStatusBadge status={task.status} />
              </SheetTitle>
              <p className="text-sm text-muted-foreground">{task.name}</p>
            </SheetHeader>

            <div className="space-y-6 p-4">
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <PriorityBadge priority={task.priority} />
                </Field>
                <Field label="Assigned worker">
                  <span className="font-mono text-sm">{task.workerId ?? "unassigned"}</span>
                </Field>
                <Field label="CPU requirement">{task.cpuRequired} vCPU</Field>
                <Field label="Memory requirement">{task.memoryRequired} GB</Field>
                <Field label="Created at">{formatDateTime(task.createdAt)}</Field>
                <Field label="Started at">
                  {task.startedAt ? formatDateTime(task.startedAt) : "—"}
                </Field>
                <Field label="Execution time">{formatDuration(task.duration)}</Field>
                <Field label="Retry count">{task.retryCount}</Field>
              </dl>

              <section>
                <h3 className="mb-3 text-sm font-semibold">Lifecycle</h3>
                <ol className="space-y-2">
                  {LIFECYCLE.map((stage, i) => {
                    const active = i === stageIndex(task);
                    const done = i < stageIndex(task);
                    return (
                      <li
                        key={stage}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm",
                          active ? "clay font-semibold text-primary" : "clay-inset text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            active ? "bg-primary" : done ? "bg-success" : "bg-border",
                          )}
                          aria-hidden="true"
                        />
                        {task.status === "failed" && i === 4 ? "Failed" : stage}
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold">Execution log</h3>
                <div className="clay-inset scrollbar-clay max-h-56 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
                  {task.logs.map((l, i) => (
                    <p key={i} className="text-muted-foreground">
                      <span className="text-foreground">{formatDateTime(l.at)}</span> [{l.level}]{" "}
                      {l.message}
                    </p>
                  ))}
                  <p className="text-muted-foreground">
                    <span className="text-foreground">{formatDateTime(Date.now())}</span> [INFO]{" "}
                    status={task.status} worker={task.workerId ?? "none"}
                  </p>
                </div>
              </section>
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
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}
