import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListTodo,
  Server,
  Cpu,
  Gauge,
  ShieldAlert,
  BarChart3,
  ScrollText,
  Settings,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSystem } from "@/hooks/useSystem";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/workers", label: "Workers", icon: Server },
  { to: "/scheduler", label: "Scheduler", icon: Cpu },
  { to: "/resources", label: "Resources", icon: Gauge },
  { to: "/faults", label: "Fault Monitor", icon: ShieldAlert },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/logs", label: "Logs", icon: ScrollText },
] as const;

export function SidebarContentPanel({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { workers } = useSystem();
  const failed = workers.filter((w) => w.status === "failed").length;

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3 px-2 py-1">
        <span className="clay flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 p-0">
          <Boxes className="h-5 w-5 text-primary" aria-hidden="true" />
        </span>
        <span>
          <span className="block font-display text-base font-semibold leading-tight">TaskFlow</span>
          <span className="block text-[11px] text-muted-foreground">Distributed Scheduler</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1" aria-label="Main navigation">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Overview
        </p>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "clay text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2">
        <Link
          to="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "clay text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </Link>
        <div className="clay-inset px-3 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">System status</p>
          <p
            className={cn(
              "mt-1 flex items-center gap-2 text-sm font-semibold",
              failed ? "text-destructive" : "text-success",
            )}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-70",
                  failed ? "bg-destructive" : "bg-success",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  failed ? "bg-destructive" : "bg-success",
                )}
              />
            </span>
            {failed ? `${failed} worker down` : "All systems operational"}
          </p>
        </div>
      </div>
    </div>
  );
}
