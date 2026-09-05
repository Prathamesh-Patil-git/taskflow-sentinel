import { Bell, AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useSystem } from "@/hooks/useSystem";
import { live } from "@/services/api";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SystemNotification } from "@/types";

const ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

const TONE = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
} as const;

export function NotificationPanel() {
  const { notifications } = useSystem();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu onOpenChange={(open) => open && live.markNotificationsRead()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="clay-press relative rounded-full"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-3xl p-2">
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notifications
        </p>
        <ul className="scrollbar-clay max-h-96 space-y-1 overflow-y-auto">
          {notifications.slice(0, 12).map((n: SystemNotification) => {
            const Icon = ICON[n.tone];
            return (
              <li key={n.id} className="flex gap-3 rounded-2xl px-3 py-2.5 hover:bg-muted">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE[n.tone])} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.detail}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
