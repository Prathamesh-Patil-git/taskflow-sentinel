import { useEffect, useState } from "react";

/** True only after the client has hydrated — use to gate time-varying UI. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
