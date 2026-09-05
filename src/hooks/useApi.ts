import { useQuery } from "@tanstack/react-query";
import {
  getAlgorithmComparison,
  getAnalyticsOverview,
  getHealth,
  getResources,
} from "@/services/api";

/** Headline analytics computed by the backend from real execution history. */
export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: getAnalyticsOverview,
    refetchInterval: 10_000,
  });
}

/** Per-algorithm scheduling metrics derived from recorded scheduler decisions. */
export function useAlgorithmComparison() {
  return useQuery({
    queryKey: ["analytics", "scheduling"],
    queryFn: getAlgorithmComparison,
    refetchInterval: 30_000,
  });
}

export function useResources() {
  return useQuery({ queryKey: ["resources"], queryFn: getResources, refetchInterval: 5_000 });
}

export function useBackendHealth() {
  return useQuery({ queryKey: ["health"], queryFn: getHealth, refetchInterval: 10_000 });
}
