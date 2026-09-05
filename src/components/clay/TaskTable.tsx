import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriorityBadge, TaskStatusBadge } from "./StatusBadge";
import { EmptyState } from "./StateViews";
import { formatDuration, timeAgo } from "@/lib/format";
import type { Task, TaskStatus } from "@/types";

const TABS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "retrying", label: "Retrying" },
];

type SortKey = "id" | "priority" | "duration" | "createdAt";
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;
const PAGE_SIZE = 8;

export function TaskTable({
  tasks,
  onSelect,
}: {
  tasks: Task[];
  onSelect?: (task: Task) => void;
}) {
  const [tab, setTab] = useState<TaskStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = tasks.filter((t) => {
      if (tab !== "all" && t.status !== tab) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (q && !`${t.id} ${t.name} ${t.workerId ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    rows.sort((a, b) => {
      let diff = 0;
      if (sortKey === "priority") diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      else if (sortKey === "duration") diff = a.duration - b.duration;
      else if (sortKey === "createdAt") diff = a.createdAt - b.createdAt;
      else diff = a.id.localeCompare(b.id);
      return sortAsc ? diff : -diff;
    });
    return rows;
  }, [tasks, tab, query, priority, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const sortBtn = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else {
          setSortKey(key);
          setSortAsc(true);
        }
      }}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      {sortKey === key ? (
        sortAsc ? (
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        )
      ) : null}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as TaskStatus | "all");
            setPage(0);
          }}
          className="min-w-0"
        >
          <TabsList className="clay-inset h-auto flex-wrap gap-1 rounded-full p-1">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-full px-3.5 py-1.5 text-xs font-semibold data-[state=active]:shadow-none"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search tasks"
              aria-label="Search tasks"
              className="clay-inset h-9 w-48 rounded-full border-0 pl-9"
            />
          </div>
          <Select
            value={priority}
            onValueChange={(v) => {
              setPriority(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="clay-inset h-9 w-36 rounded-full border-0" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No tasks match these filters" description="Adjust the search, tab or priority filter." />
      ) : (
        <div className="scrollbar-clay overflow-x-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 pb-1 font-semibold">{sortBtn("id", "Task ID")}</th>
                <th className="px-4 pb-1 font-semibold">Task name</th>
                <th className="px-4 pb-1 font-semibold">{sortBtn("priority", "Priority")}</th>
                <th className="px-4 pb-1 font-semibold">CPU</th>
                <th className="px-4 pb-1 font-semibold">Memory</th>
                <th className="px-4 pb-1 font-semibold">Worker</th>
                <th className="px-4 pb-1 font-semibold">Status</th>
                <th className="px-4 pb-1 font-semibold">{sortBtn("duration", "Duration")}</th>
                <th className="px-4 pb-1 font-semibold">{sortBtn("createdAt", "Created")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <tr
                  key={task.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => onSelect?.(task)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(task);
                    }
                  }}
                  className="clay cursor-pointer outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring [&>td]:bg-card [&>td]:px-4 [&>td]:py-3"
                >
                  <td className="rounded-l-2xl font-mono text-xs font-semibold">{task.id}</td>
                  <td className="font-medium">{task.name}</td>
                  <td>
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="tabular-nums text-muted-foreground">{task.cpuRequired} CPU</td>
                  <td className="tabular-nums text-muted-foreground">{task.memoryRequired} GB</td>
                  <td className="font-mono text-xs text-muted-foreground">{task.workerId ?? "—"}</td>
                  <td>
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="tabular-nums text-muted-foreground">
                    {task.status === "pending" ? "—" : formatDuration(task.duration)}
                  </td>
                  <td className="rounded-r-2xl text-xs text-muted-foreground">
                    {timeAgo(task.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {filtered.length} task{filtered.length === 1 ? "" : "s"} · page {current + 1} of {pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="clay-press rounded-full"
            onClick={() => setPage(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="clay-press rounded-full"
            onClick={() => setPage(Math.min(pageCount - 1, current + 1))}
            disabled={current >= pageCount - 1}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
