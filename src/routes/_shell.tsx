import { createFileRoute, Outlet } from "@tanstack/react-router";
import { motion } from "motion/react";
import { SidebarContentPanel } from "@/components/layout/Sidebar";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { LoadingState } from "@/components/clay/StateViews";
import { useHydrated } from "@/hooks/useHydrated";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  // The cluster feed is a live, time-based stream, so it only renders after
  // hydration — server and client snapshots can never match by definition.
  const hydrated = useHydrated();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border/60 bg-sidebar/60 backdrop-blur-xl lg:block">
        <SidebarContentPanel />
      </aside>
      <div className="min-w-0 flex-1 px-4 pb-10 sm:px-6">
        {hydrated ? (
          <>
            <TopNavigation />
            <motion.main
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.main>
          </>
        ) : (
          <div className="pt-8">
            <LoadingState rows={4} label="Connecting to cluster" />
          </div>
        )}
      </div>
    </div>
  );
}
