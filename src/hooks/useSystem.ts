import { useSyncExternalStore } from "react";
import { live, buildSummary } from "@/services/api";
import type { SystemSnapshot, DashboardSummary } from "@/types";

/** Subscribes to the live cluster feed (stands in for the /ws/dashboard socket). */
export function useSystem(): SystemSnapshot {
  return useSyncExternalStore(live.subscribe, live.getState, live.getState);
}

export function useSummary(): DashboardSummary {
  return buildSummary(useSystem());
}
