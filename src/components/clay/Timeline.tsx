import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/format";

export interface TimelineItem {
  at: number;
  message: string;
  tone: "info" | "warning" | "danger" | "success";
  detail?: string;
}

const TONE: Record<TimelineItem["tone"], string> = {
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No events recorded.</p>;
  }
  return (
    <ol className="relative space-y-4 pl-6">
      <span className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
      {items.map((item, i) => (
        <motion.li
          key={`${item.at}-${i}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.04 }}
          className="relative"
        >
          <span
            className={cn(
              "absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-background",
              TONE[item.tone],
            )}
            aria-hidden="true"
          />
          <p className="font-mono text-xs text-muted-foreground">{formatClock(item.at)}</p>
          <p className="text-sm font-medium text-foreground">{item.message}</p>
          {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
        </motion.li>
      ))}
    </ol>
  );
}
