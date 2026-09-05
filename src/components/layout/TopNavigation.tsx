import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, Activity, LogOut, User, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationPanel } from "./NotificationPanel";
import { ThemeToggle } from "./ThemeToggle";
import { SidebarContentPanel, NAV_ITEMS } from "./Sidebar";
import { useSummary } from "@/hooks/useSystem";
import { cn } from "@/lib/utils";

export function TopNavigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const summary = useSummary();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const title =
    pathname === "/settings"
      ? "Settings"
      : (NAV_ITEMS.find((i) => i.to === pathname)?.label ?? "TaskFlow");

  const healthTone =
    summary.systemHealth >= 90 ? "text-success" : summary.systemHealth >= 70 ? "text-warning" : "text-destructive";

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    if (q.startsWith("t-")) navigate({ to: "/tasks" });
    else if (q.startsWith("worker")) navigate({ to: "/workers" });
    else navigate({ to: "/logs" });
  };

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-6 bg-background/70 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <div className="clay flex items-center gap-3 px-3 py-2.5">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="clay-press rounded-full lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContentPanel onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>

        <h2 className="font-display text-base font-semibold sm:text-lg">{title}</h2>

        <form onSubmit={submitSearch} className="relative ml-auto hidden md:block" role="search">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, workers, logs…"
            aria-label="Global search"
            className="clay-inset h-9 w-64 rounded-full border-0 pl-9"
          />
        </form>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <span
            className={cn(
              "clay-inset hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold sm:flex",
              healthTone,
            )}
            title="Overall system health"
          >
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            {summary.systemHealth}% healthy
          </span>
          <NotificationPanel />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="clay-press rounded-full"
                aria-label="Account menu"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  AV
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl">
              <div className="px-2 py-1.5">
                <p className="text-sm font-semibold">Ava Rodrigues</p>
                <p className="text-xs text-muted-foreground">Platform SRE</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
