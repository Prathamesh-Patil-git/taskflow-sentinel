import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  change?: number;
  changeCaption?: string;
  sparkline?: number[];
  tone?: "primary" | "success" | "warning" | "danger" | "info";
  index?: number;
}

const TONE: Record<NonNullable<Props["tone"]>, { text: string; bg: string; stroke: string }> = {
  primary: { text: "text-primary", bg: "bg-primary/12", stroke: "var(--primary)" },
  success: { text: "text-success", bg: "bg-success/12", stroke: "var(--success)" },
  warning: { text: "text-warning", bg: "bg-warning/15", stroke: "var(--warning)" },
  danger: { text: "text-destructive", bg: "bg-destructive/12", stroke: "var(--destructive)" },
  info: { text: "text-info", bg: "bg-info/12", stroke: "var(--info)" },
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  change,
  changeCaption = "vs last 24h",
  sparkline = [],
  tone = "primary",
  index = 0,
}: Props) {
  const t = TONE[tone];
  const data = sparkline.map((v, i) => ({ i, v }));
  const TrendIcon = change === undefined || change === 0 ? Minus : change > 0 ? TrendingUp : TrendingDown;
  const trendClass =
    change === undefined || change === 0
      ? "text-muted-foreground"
      : change > 0
        ? "text-success"
        : "text-destructive";

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="clay clay-hover p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("rounded-2xl p-2.5", t.bg)}>
          <Icon className={cn("h-4.5 w-4.5", t.text)} aria-hidden="true" />
        </div>
        <div className="h-9 w-24">
          {data.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.stroke} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={t.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={t.stroke}
                  strokeWidth={2}
                  fill={`url(#spark-${label.replace(/\s/g, "")})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs font-medium", trendClass)}>
        <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {change === undefined ? "steady" : `${change > 0 ? "+" : ""}${change}%`}
        <span className="text-muted-foreground">{changeCaption}</span>
      </p>
    </motion.article>
  );
}
