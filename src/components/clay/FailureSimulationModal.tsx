import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { simulateFailure } from "@/services/api";
import type { Worker } from "@/types";

export function FailureSimulationModal({
  workers,
  open,
  onOpenChange,
  defaultWorkerId,
}: {
  workers: Worker[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWorkerId?: string | undefined;
}) {
  const candidates = workers.filter((w) => w.status === "online" || w.status === "overloaded");
  const [workerId, setWorkerId] = useState(defaultWorkerId ?? candidates[0]?.id ?? "");

  const run = async () => {
    const target = workerId || candidates[0]?.id;
    if (!target) return;
    onOpenChange(false);
    try {
      const result = await simulateFailure(target);
      toast.error(`${target} stopped sending heartbeats`, {
        description:
          result.mode === "immediate"
            ? `${result.affectedTasks} running tasks moved to the retry queue.`
            : `The failure detector will mark it FAILED in ~${result.detectsInSeconds}s, then its tasks are requeued.`,
      });
    } catch {
      toast.error("Could not reach the cluster", {
        description: "The backend did not accept the failure injection.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
            Simulate worker failure
          </DialogTitle>
          <DialogDescription>
            The selected worker stops sending heartbeats. Its running tasks are detected, requeued
            and reassigned automatically.
          </DialogDescription>
        </DialogHeader>

        <Select value={workerId} onValueChange={setWorkerId}>
          <SelectTrigger className="clay-inset h-11 rounded-2xl border-0" aria-label="Select worker">
            <SelectValue placeholder="Select worker" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            {candidates.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.id} · {w.activeTasks} active tasks
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" className="clay-press rounded-full" onClick={run}>
            Trigger failure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
