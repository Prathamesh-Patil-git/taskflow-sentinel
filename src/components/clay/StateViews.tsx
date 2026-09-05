import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ rows = 3, label = "Loading data" }: { rows?: number; label?: string }) {
  return (
    <div className="clay space-y-3 p-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-40 rounded-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function EmptyState({
  title = "Nothing to show yet",
  description = "Data will appear here as the cluster reports in.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="clay flex flex-col items-center gap-2 p-10 text-center">
      <div className="clay-inset rounded-full p-4">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this section",
  description = "The cluster feed didn't respond. Try again in a moment.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="clay flex flex-col items-center gap-3 p-10 text-center" role="alert">
      <div className="rounded-full bg-destructive/12 p-4">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button onClick={onRetry} className="mt-2 rounded-full clay-press">
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
