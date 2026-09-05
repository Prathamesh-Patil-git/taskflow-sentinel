import { WifiOff } from "lucide-react";
import { live } from "@/services/api";
import { useSystem } from "@/hooks/useSystem";

/** Shown while the backend cluster API cannot be reached. */
export function ConnectionBanner() {
  const state = useSystem();
  const offline = !live.isConnected() && state.updatedAt === 0;
  if (!offline) return null;

  return (
    <div
      role="status"
      className="clay-inset mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground"
    >
      <WifiOff className="h-4 w-4 text-warning" aria-hidden="true" />
      <span>
        Waiting for the scheduler service. Start the cluster with{" "}
        <code className="font-mono text-foreground">docker compose up --build</code>.
      </span>
    </div>
  );
}
