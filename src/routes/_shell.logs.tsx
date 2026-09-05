import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, ArrowDownToLine } from "lucide-react";
import { PageHeader } from "@/components/clay/PageHeader";
import { ClayCard, ClaySectionHeader } from "@/components/clay/ClayCard";
import { LogLevelBadge } from "@/components/clay/StatusBadge";
import { EmptyState } from "@/components/clay/StateViews";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSystem } from "@/hooks/useSystem";
import { formatDateTime } from "@/lib/format";
import type { LogLevel } from "@/types";

export const Route = createFileRoute("/_shell/logs")({
  head: () => ({
    meta: [
      { title: "System Logs — TaskFlow" },
      {
        name: "description",
        content:
          "Stream scheduler, worker and database logs with level filters, worker filters, search and auto-scroll.",
      },
      { property: "og:title", content: "System Logs — TaskFlow" },
      {
        property: "og:description",
        content: "Live log stream across every component of the distributed scheduler.",
      },
    ],
  }),
  component: LogsPage,
});

const LEVELS: LogLevel[] = ["info", "warning", "error", "critical"];

function LogsPage() {
  const { logs, workers } = useSystem();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<string>("all");
  const [worker, setWorker] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      logs.filter((l) => {
        if (level !== "all" && l.level !== level) return false;
        if (worker !== "all" && l.workerId !== worker) return false;
        if (query && !`${l.message} ${l.component} ${l.workerId ?? ""}`.toLowerCase().includes(query.toLowerCase()))
          return false;
        return true;
      }),
    [logs, level, worker, query],
  );

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [filtered.length, autoScroll]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Logs"
        subtitle="Unified stream from the scheduler, worker agents, task queue and database."
      />

      <ClayCard>
        <ClaySectionHeader
          title="Log Stream"
          description={`${filtered.length} of ${logs.length} entries`}
        />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages, components…"
              aria-label="Search logs"
              className="clay-inset h-11 rounded-full border-0 pl-9"
            />
          </div>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="clay h-11 w-40 rounded-full border-0" aria-label="Filter by level">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All levels</SelectItem>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l} className="capitalize">
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={worker} onValueChange={setWorker}>
            <SelectTrigger className="clay h-11 w-44 rounded-full border-0" aria-label="Filter by worker">
              <SelectValue placeholder="Worker" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All workers</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="clay flex items-center gap-2 rounded-full px-4 py-2.5">
            <ArrowDownToLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Label htmlFor="autoscroll" className="text-xs font-semibold">
              Auto-scroll
            </Label>
            <Switch id="autoscroll" checked={autoScroll} onCheckedChange={setAutoScroll} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No matching log entries" description="Adjust the filters or search term." />
        ) : (
          <div className="scrollbar-clay clay-inset max-h-[560px] overflow-y-auto p-2 font-mono text-xs">
            <ul className="space-y-1">
              {filtered.map((l) => (
                <li
                  key={l.id}
                  className="grid grid-cols-[150px_92px_130px_1fr] items-start gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/60 max-md:grid-cols-1 max-md:gap-1"
                >
                  <span className="text-muted-foreground">{formatDateTime(l.timestamp)}</span>
                  <LogLevelBadge level={l.level} />
                  <span className="text-muted-foreground">
                    {l.component}
                    {l.workerId ? ` · ${l.workerId}` : ""}
                  </span>
                  <span className="break-words text-foreground">{l.message}</span>
                </li>
              ))}
            </ul>
            <div ref={endRef} />
          </div>
        )}
      </ClayCard>
    </div>
  );
}
