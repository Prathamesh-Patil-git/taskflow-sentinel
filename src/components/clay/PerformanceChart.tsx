import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export interface SeriesConfig {
  key: string;
  label: string;
  color: string;
}

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 16,
      border: "1px solid var(--border)",
      background: "var(--popover)",
      color: "var(--popover-foreground)",
      boxShadow: "var(--clay-out)",
      fontSize: 12,
    },
    labelStyle: { color: "var(--muted-foreground)" },
  };
}

export function AreaSeriesChart({
  data,
  series,
  xKey = "label",
  height = 300,
}: {
  data: Record<string, unknown>[];
  series: SeriesConfig[];
  xKey?: string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} width={44} />
          <Tooltip {...tooltipStyle()} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#area-${s.key})`}
              animationDuration={700}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineSeriesChart({
  data,
  series,
  xKey = "label",
  height = 280,
}: {
  data: Record<string, unknown>[];
  series: SeriesConfig[];
  xKey?: string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} width={44} />
          <Tooltip {...tooltipStyle()} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.2}
              dot={false}
              animationDuration={700}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarSeriesChart({
  data,
  series,
  xKey = "label",
  height = 280,
  showLegend = false,
}: {
  data: Record<string, unknown>[];
  series: SeriesConfig[];
  xKey?: string;
  height?: number;
  showLegend?: boolean;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} width={44} />
          <Tooltip {...tooltipStyle()} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          {showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              radius={[10, 10, 6, 6]}
              animationDuration={700}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LegendPills({ series }: { series: SeriesConfig[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {series.map((s) => (
        <span
          key={s.key}
          className="clay-inset flex items-center gap-2 px-3 py-1 text-xs font-medium text-muted-foreground"
        >
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </span>
      ))}
    </div>
  );
}
