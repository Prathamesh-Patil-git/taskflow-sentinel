import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTask, live } from "@/services/api";

const TASK_TYPES = ["CPU_TASK", "MEMORY_TASK", "SLEEP_TASK", "FAILURE_TASK", "RANDOM_TASK"];
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

/** Submits a real task to the backend queue; the scheduler assigns a worker. */
export function SubmitTaskDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Batch aggregation");
  const [taskType, setTaskType] = useState("CPU_TASK");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("MEDIUM");
  const [cpu, setCpu] = useState("1");
  const [memory, setMemory] = useState("1");
  const [duration, setDuration] = useState("8");

  const submit = async () => {
    setBusy(true);
    try {
      const task = await createTask({
        name: name.trim() || "Untitled task",
        task_type: taskType,
        priority,
        cpu_required: Number(cpu) || 1,
        memory_required: Number(memory) || 1,
        estimated_duration: Number(duration) || 5,
      });
      toast.success(`${task.id} queued`, { description: "Waiting for a scheduling decision." });
      await live.refresh();
      setOpen(false);
    } catch {
      toast.error("Task was not accepted", { description: "Check the cluster connection." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="clay-press rounded-full">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Submit task
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Submit a task</DialogTitle>
          <DialogDescription>
            The task enters the real queue and is assigned by the active scheduling algorithm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-name">Name</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="clay-inset h-11 rounded-2xl border-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Workload</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger className="clay-inset h-11 rounded-2xl border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ").toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger className="clay-inset h-11 rounded-2xl border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-cpu">vCPU</Label>
              <Input
                id="task-cpu"
                type="number"
                min="0.5"
                step="0.5"
                value={cpu}
                onChange={(e) => setCpu(e.target.value)}
                className="clay-inset h-11 rounded-2xl border-0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-mem">Memory (GB)</Label>
              <Input
                id="task-mem"
                type="number"
                min="0.5"
                step="0.5"
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
                className="clay-inset h-11 rounded-2xl border-0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-dur">Duration (s)</Label>
              <Input
                id="task-dur"
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="clay-inset h-11 rounded-2xl border-0"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="clay-press rounded-full" disabled={busy} onClick={() => void submit()}>
            {busy ? "Submitting…" : "Submit task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
