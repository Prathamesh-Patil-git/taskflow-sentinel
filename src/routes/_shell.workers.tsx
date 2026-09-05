import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/clay/PageHeader";
import { ClayCard, ClaySectionHeader } from "@/components/clay/ClayCard";
import { WorkerCard } from "@/components/clay/WorkerCard";
import { WorkerDetailDrawer } from "@/components/clay/WorkerDetailDrawer";
import { FailureSimulationModal } from "@/components/clay/FailureSimulationModal";
import { ClusterTopology } from "@/components/clay/ClusterTopology";
import { EmptyState } from "@/components/clay/StateViews";
import { Button } from "@/components/ui/button";
import { useSystem } from "@/hooks/useSystem";
import { recoverWorker } from "@/services/api";
import type { Worker } from "@/types";

export const Route = createFileRoute("/_shell/workers")({
  head: () => ({
    meta: [
      { title: "Worker Nodes — TaskFlow" },
      {
        name: "description",
        content:
          "Monitor every worker node: CPU and memory utilization, active tasks, uptime, heartbeat freshness and reliability.",
      },
      { property: "og:title", content: "Worker Nodes — TaskFlow" },
      {
        property: "og:description",
        content: "Node level health and utilization across the distributed worker cluster.",
      },
    ],
  }),
  component: WorkersPage,
});

function WorkersPage() {
  const state = useSystem();
  const [selected, setSelected] = useState<Worker | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [simFor, setSimFor] = useState<string | undefined>();

  const handleRecover = async (worker: Worker) => {
    try {
      await recoverWorker(worker.id);
      toast.success(`Recovering worker ${worker.id}`, {
        description: "The worker is re-registering with the cluster.",
      });
    } catch {
      toast.error(`Could not recover ${worker.id}`, {
        description: "The backend did not accept the recovery request.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worker Nodes"
        subtitle="Utilization, capacity and heartbeat health for every node in the cluster."
        actions={
          <Button
            variant="destructive"
            className="clay-press rounded-full"
            onClick={() => {
              setSimFor(undefined);
              setSimOpen(true);
            }}
          >
            <ShieldAlert className="mr-2 h-4 w-4" aria-hidden="true" />
            Simulate failure
          </Button>
        }
      />

      {state.workers.length === 0 ? (
        <EmptyState title="No workers registered" description="Nodes appear here once they join the cluster." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {state.workers.map((w, i) => (
            <WorkerCard
              key={w.id}
              worker={w}
              index={i}
              onInspect={setSelected}
              onSimulateFailure={(worker) => {
                setSimFor(worker.id);
                setSimOpen(true);
              }}
              onRecoverWorker={handleRecover}
            />
          ))}
        </div>
      )}

      <ClayCard>
        <ClaySectionHeader title="Cluster Topology" description="Scheduler fan-out and node status" />
        <ClusterTopology workers={state.workers} />
      </ClayCard>

      <WorkerDetailDrawer
        worker={selected}
        tasks={state.tasks}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        onSimulateFailure={(w) => {
          setSelected(null);
          setSimFor(w.id);
          setSimOpen(true);
        }}
        onRecoverWorker={handleRecover}
      />
      <FailureSimulationModal
        workers={state.workers}
        open={simOpen}
        onOpenChange={setSimOpen}
        defaultWorkerId={simFor}
      />
    </div>
  );
}
