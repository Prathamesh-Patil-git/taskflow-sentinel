import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

export type GaugeTone = "primary" | "success" | "warning" | "danger" | "info";

const TONE_COLORS: Record<GaugeTone, [string, string]> = {
  primary: ["var(--primary)", "var(--info)"],
  success: ["var(--success)", "var(--info)"],
  warning: ["var(--warning)", "var(--destructive)"],
  danger: ["var(--destructive)", "var(--warning)"],
  info: ["var(--info)", "var(--primary)"],
};

export function toneForValue(value: number, invert = false): GaugeTone {
  const v = invert ? 100 - value : value;
  if (v >= 85) return "danger";
  if (v >= 70) return "warning";
  return "success";
}

interface Props {
  value: number;
  label?: string;
  caption?: string;
  size?: number;
  thickness?: number;
  tone?: GaugeTone;
  suffix?: string;
  className?: string;
  compact?: boolean;
}

/** Premium radial instrument gauge — animated SVG arc with gradient progress. */
export function CircularGauge({
  value,
  label,
  caption,
  size = 168,
  thickness = 14,
  tone = "primary",
  suffix = "%",
  className,
  compact = false,
}: Props) {
  const id = useId().replace(/:/g, "");
  const [display, setDisplay] = useState(0);
  const clamped = Math.max(0, Math.min(100, value));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDisplay(clamped));
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  const radius = (size - thickness) / 2;
  const center = size / 2;
  const gapDeg = 60;
  const arcDeg = 360 - gapDeg;
  const circumference = 2 * Math.PI * radius;
  const trackLength = (arcDeg / 360) * circumference;
  const progressLength = (display / 100) * trackLength;
  const [from, to] = TONE_COLORS[tone];

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      role="img"
      aria-label={`${label ?? "Gauge"}: ${Math.round(clamped)}${suffix}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-[210deg]" aria-hidden="true">
          <defs>
            <linearGradient id={`grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${trackLength} ${circumference}`}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#grad-${id})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${circumference}`}
            style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-display font-semibold tabular-nums text-foreground",
              compact ? "text-lg" : "text-3xl sm:text-4xl",
            )}
          >
            {Math.round(clamped)}
            <span className={compact ? "text-xs" : "text-lg"}>{suffix}</span>
          </span>
          {label && !compact ? (
            <span className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
          ) : null}
        </div>
      </div>
      {compact && label ? (
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      ) : null}
      {caption ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}
