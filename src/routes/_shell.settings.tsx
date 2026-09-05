import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/clay/PageHeader";
import { ClayCard, ClaySectionHeader } from "@/components/clay/ClayCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSystem } from "@/hooks/useSystem";
import { updateAlgorithm } from "@/services/api";
import type { SchedulingAlgorithm } from "@/types";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TaskFlow" },
      {
        name: "description",
        content:
          "Configure cluster endpoints, scheduling defaults, retry policy, heartbeat intervals and alert notifications.",
      },
      { property: "og:title", content: "Settings — TaskFlow" },
      {
        property: "og:description",
        content: "Cluster, scheduling and alerting configuration for the TaskFlow control plane.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { scheduler } = useSystem();
  const [apiUrl, setApiUrl] = useState("https://api.taskflow.internal");
  const [wsUrl, setWsUrl] = useState("wss://api.taskflow.internal/ws/dashboard");
  const [retries, setRetries] = useState("3");
  const [heartbeat, setHeartbeat] = useState("5");
  const [alerts, setAlerts] = useState(true);
  const [autoRecover, setAutoRecover] = useState(true);
  const [compact, setCompact] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Control plane configuration for the cluster, scheduler and alerting."
        actions={
          <Button
            className="clay-press rounded-full"
            onClick={() => toast.success("Settings saved", { description: "Configuration applied to the control plane." })}
          >
            Save changes
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ClayCard>
          <ClaySectionHeader title="Backend Connection" description="Endpoints used once the FastAPI service is attached." />
          <div className="space-y-4">
            <Field id="api" label="REST base URL" value={apiUrl} onChange={setApiUrl} />
            <Field id="ws" label="WebSocket URL" value={wsUrl} onChange={setWsUrl} />
          </div>
        </ClayCard>

        <ClayCard>
          <ClaySectionHeader title="Scheduling Defaults" description="Applied to newly submitted tasks." />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="algo">Default algorithm</Label>
              <Select
                value={scheduler.algorithm}
                onValueChange={(v) => void updateAlgorithm(v as SchedulingAlgorithm)}
              >
                <SelectTrigger id="algo" className="clay-inset h-11 rounded-2xl border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="round-robin">Round Robin</SelectItem>
                  <SelectItem value="least-loaded">Least Loaded</SelectItem>
                  <SelectItem value="resource-aware">Resource Aware</SelectItem>
                  <SelectItem value="priority-based">Priority Based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field id="retries" label="Max retries per task" value={retries} onChange={setRetries} type="number" />
            <Field id="hb" label="Heartbeat interval (seconds)" value={heartbeat} onChange={setHeartbeat} type="number" />
          </div>
        </ClayCard>

        <ClayCard>
          <ClaySectionHeader title="Fault Tolerance" description="How the cluster reacts to node failures." />
          <div className="space-y-3">
            <ToggleRow
              id="autorecover"
              label="Automatic task reassignment"
              description="Requeue and reschedule interrupted tasks the moment a node fails."
              checked={autoRecover}
              onChange={setAutoRecover}
            />
            <ToggleRow
              id="alerts"
              label="Failure alerts"
              description="Send a notification whenever a worker degrades or drops out."
              checked={alerts}
              onChange={setAlerts}
            />
          </div>
        </ClayCard>

        <ClayCard>
          <ClaySectionHeader title="Appearance" description="Display preferences for this console." />
          <ToggleRow
            id="compact"
            label="Compact tables"
            description="Reduce row height in task and worker tables."
            checked={compact}
            onChange={setCompact}
          />
        </ClayCard>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="clay-inset h-11 rounded-2xl border-0"
      />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="clay-inset flex items-center gap-4 px-4 py-3">
      <div className="flex-1">
        <Label htmlFor={id} className="text-sm font-semibold">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
