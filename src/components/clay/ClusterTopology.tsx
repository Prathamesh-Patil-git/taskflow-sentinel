import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Server, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Worker } from "@/types";

const STATUS_RING: Record<Worker["status"], string> = {
  online: "text-success",
  overloaded: "text-warning",
  failed: "text-destructive",
  offline: "text-muted-foreground",
};

const STATUS_DOT: Record<Worker["status"], string> = {
  online: "bg-success",
  overloaded: "bg-warning",
  failed: "bg-destructive",
  offline: "bg-muted-foreground",
};

interface LineTarget {
  /** Horizontal center of the card relative to the wrapper */
  cx: number;
}

/** Scheduler → worker fan-out with dynamically positioned connection lines. */
export function ClusterTopology({ workers }: { workers: Worker[] }) {
  const nodes = workers.slice(0, 6);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const schedulerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lines, setLines] = useState<LineTarget[]>([]);
  const [svgWidth, setSvgWidth] = useState(600);
  const [schedulerCx, setSchedulerCx] = useState(300);

  const measure = useCallback(() => {
    const wrapper = wrapperRef.current;
    const scheduler = schedulerRef.current;
    if (!wrapper || !scheduler) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const schedRect = scheduler.getBoundingClientRect();
    const cx = schedRect.left + schedRect.width / 2 - wrapperRect.left;

    setSvgWidth(wrapperRect.width);
    setSchedulerCx(cx);

    const targets: LineTarget[] = [];
    for (const card of cardRefs.current) {
      if (!card) continue;
      const r = card.getBoundingClientRect();
      targets.push({ cx: r.left + r.width / 2 - wrapperRect.left });
    }
    setLines(targets);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, nodes.length]);

  const svgH = 64;

  // Adaptive grid columns: match the number of workers so each card gets equal space
  const colClass =
    nodes.length <= 2
      ? "grid-cols-2"
      : nodes.length <= 3
        ? "grid-cols-2 sm:grid-cols-3"
        : nodes.length <= 4
          ? "grid-cols-2 sm:grid-cols-4"
          : nodes.length <= 5
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";

  return (
    <div className="flex flex-col items-center" ref={wrapperRef}>
      {/* Scheduler pill */}
      <div
        ref={schedulerRef}
        className="clay-inset flex items-center gap-2 px-5 py-3"
      >
        <Network className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="font-display text-sm font-semibold">Scheduler</span>
      </div>

      {/* Connection lines */}
      <svg
        className="w-full"
        style={{ height: svgH }}
        viewBox={`0 0 ${svgWidth} ${svgH}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {lines.map((target, i) => {
          const path = `M${schedulerCx} 0 C${schedulerCx} ${svgH * 0.55}, ${target.cx} ${svgH * 0.4}, ${target.cx} ${svgH}`;
          const worker = nodes[i];
          const dotColor =
            worker?.status === "failed"
              ? "var(--destructive)"
              : worker?.status === "overloaded"
                ? "var(--warning)"
                : "var(--primary)";
          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke="var(--border)"
                strokeWidth={2}
              />
              <motion.circle
                r={3}
                fill={dotColor}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              >
                <animateMotion
                  dur="2.4s"
                  repeatCount="indefinite"
                  begin={`${i * 0.3}s`}
                  path={path}
                />
              </motion.circle>
            </g>
          );
        })}
      </svg>

      {/* Worker cards */}
      <div className={cn("grid w-full gap-3", colClass)}>
        {nodes.map((w, i) => (
          <div
            key={w.id}
            ref={(el) => { cardRefs.current[i] = el; }}
            className="clay p-3 text-center"
          >
            <Server
              className={cn("mx-auto h-4 w-4", STATUS_RING[w.status])}
              aria-hidden="true"
            />
            <p className="mt-1.5 font-mono text-[11px] font-semibold">
              {w.id}
            </p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  STATUS_DOT[w.status],
                )}
              />
              {w.status}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {w.activeTasks} tasks
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

