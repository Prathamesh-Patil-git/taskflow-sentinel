import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Boxes, ArrowRight, ShieldCheck, Activity, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TaskFlow — Distributed Task Scheduler Control Plane" },
      {
        name: "description",
        content:
          "Sign in to TaskFlow to monitor distributed tasks, worker nodes, resource allocation and automatic fault recovery in real time.",
      },
      { property: "og:title", content: "TaskFlow — Distributed Task Scheduler Control Plane" },
      {
        property: "og:description",
        content:
          "Intelligent scheduling and resilient infrastructure monitoring for distributed compute clusters.",
      },
    ],
  }),
  component: LoginPage,
});

function NodeField() {
  const nodes = Array.from({ length: 22 }, (_, i) => ({
    x: (i * 137) % 100,
    y: (i * 61) % 100,
    d: 2 + (i % 5),
  }));
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {nodes.map((n, i) => {
        const next = nodes[(i + 5) % nodes.length]!;
        return (
          <line
            key={`l-${i}`}
            x1={n.x}
            y1={n.y}
            x2={next.x}
            y2={next.y}
            stroke="var(--primary)"
            strokeOpacity={0.12}
            strokeWidth={0.15}
          />
        );
      })}
      {nodes.map((n, i) => (
        <motion.circle
          key={`c-${i}`}
          cx={n.x}
          cy={n.y}
          r={0.5}
          fill="var(--primary)"
          initial={{ opacity: 0.2 }}
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: n.d, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </svg>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("ava@taskflow.io");
  const [password, setPassword] = useState("scheduler");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <NodeField />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-4xl overflow-hidden"
      >
        <div className="clay-lg grid gap-8 p-6 sm:p-10 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <span className="clay flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 p-0">
                <Boxes className="h-6 w-6 text-primary" aria-hidden="true" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-semibold">TaskFlow</h1>
                <p className="text-xs text-muted-foreground">Distributed Scheduler</p>
              </div>
            </div>
            <p className="mt-6 font-display text-xl font-semibold leading-snug">
              Intelligent scheduling.
              <br />
              Resilient infrastructure.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Live visibility into every task, worker node, allocation decision and automatic
              recovery across your cluster.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                { icon: Activity, text: "Real-time task and worker telemetry" },
                { icon: Cpu, text: "Resource-aware scheduling decisions" },
                { icon: ShieldCheck, text: "Automatic fault detection and recovery" },
              ].map((f) => (
                <li key={f.text} className="clay-inset flex items-center gap-3 px-4 py-2.5 text-sm">
                  <f.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {f.text}
                </li>
              ))}
            </ul>
          </div>

          <form
            className="clay flex flex-col justify-center gap-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/dashboard" });
            }}
          >
            <h2 className="font-display text-lg font-semibold">Sign in to the control plane</h2>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="clay-inset h-11 rounded-2xl border-0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="clay-inset h-11 rounded-2xl border-0"
              />
            </div>
            <Button type="submit" className="clay-press mt-2 h-11 w-full rounded-full text-sm font-semibold">
              Enter dashboard
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Demo environment — any credentials open the{" "}
              <Link to="/dashboard" className="font-medium text-primary underline-offset-4 hover:underline">
                live dashboard
              </Link>
              .
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
