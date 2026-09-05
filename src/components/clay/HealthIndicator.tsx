import { cn } from "@/lib/utils";

type Health = "healthy" | "degraded" | "down";

const TONE: Record<Health, { dot: string; text: string; label: string }> = {
  healthy: { dot: "bg-success", text: "text-success", label: "Healthy" },
  degraded: { dot: "bg-warning", text: "text-warning", label: "Degraded" },
  down: { dot: "bg-destructive", text: "text-destructive", label: "Down" },
};

export function HealthIndicator({
  name,
  state,
  detail,
}: {
  name: string;
  state: Health;
  detail?: string;
}) {
  const t = TONE[state];
  return (
    <div className="clay-inset flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      <span className={cn("flex shrink-0 items-center gap-2 text-xs font-semibold", t.text)}>
        <span className="relative flex h-2 w-2">
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", t.dot)} />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", t.dot)} />
        </span>
        {t.label}
      </span>
    </div>
  );
}
