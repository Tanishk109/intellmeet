import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KanbanSquare,
  Plus,
  Trash2,
  GripVertical,
  Video as VideoIcon,
  X,
} from "lucide-react";
import { Card, Spinner } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select, Textarea } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { taskApi } from "@/api";
import { apiErrorMessage } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority, TaskStatus } from "@/types";

const COLUMNS: { id: TaskStatus; label: string; accent: string }[] = [
  { id: "todo", label: "To Do", accent: "bg-text-lo" },
  { id: "in_progress", label: "In Progress", accent: "bg-signal-500" },
  { id: "done", label: "Done", accent: "bg-ai-500" },
];

const priorityStyle: Record<TaskPriority, string> = {
  low: "bg-ink-700 text-text-mid",
  medium: "bg-signal-500/15 text-signal-400",
  high: "bg-danger-500/15 text-danger-500",
};

export default function Board() {
  const qc = useQueryClient();
  const push = useToast((s) => s.push);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: tasks, isLoading } = useQuery({ queryKey: ["tasks"], queryFn: taskApi.list });

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    (tasks ?? []).forEach((t) => map[t.status].push(t));
    (Object.keys(map) as TaskStatus[]).forEach((k) =>
      map[k].sort((a, b) => a.order - b.order)
    );
    return map;
  }, [tasks]);

  const move = useMutation({
    mutationFn: ({ id, status, order }: { id: string; status: TaskStatus; order: number }) =>
      taskApi.move(id, { status, order }),
    // Optimistic: update the cache immediately so the card snaps into place.
    onMutate: async ({ id, status, order }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      qc.setQueryData<Task[]>(["tasks"], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, status, order } : t))
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
      push(apiErrorMessage(err), "error");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => taskApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      push("Task deleted", "info");
    },
  });

  const onDrop = (status: TaskStatus) => {
    setOverCol(null);
    if (!dragId) return;
    const colCount = byColumn[status].length;
    move.mutate({ id: dragId, status, order: colCount });
    setDragId(null);
  };

  const handleDragOver = (e: DragEvent, col: TaskStatus) => {
    e.preventDefault();
    setOverCol(col);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-signal-500/15 text-signal-400">
            <KanbanSquare className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-hi">Project board</h1>
            <p className="text-sm text-text-mid">
              Track tasks across your team. Drag cards between columns.
            </p>
          </div>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" /> New task
        </Button>
      </div>

      {isLoading ? (
        <div className="grid h-48 place-items-center">
          <Spinner className="size-6 text-signal-400" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => setOverCol(null)}
              onDrop={() => onDrop(col.id)}
              className={cn(
                "flex flex-col rounded-[var(--radius-card)] border p-3 transition-colors",
                overCol === col.id
                  ? "border-signal-500/60 bg-signal-500/5"
                  : "border-line bg-ink-900/40"
              )}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={cn("size-2 rounded-full", col.accent)} />
                <h2 className="text-sm font-semibold text-text-hi">{col.label}</h2>
                <span className="ml-auto text-xs text-text-lo">{byColumn[col.id].length}</span>
              </div>

              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {byColumn[col.id].map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "group cursor-grab rounded-lg border border-line bg-ink-850 p-3 active:cursor-grabbing",
                      dragId === task.id && "opacity-40"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-0.5 size-4 shrink-0 text-text-lo" />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            task.status === "done"
                              ? "text-text-lo line-through"
                              : "text-text-hi"
                          )}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-text-mid">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                              priorityStyle[task.priority]
                            )}
                          >
                            {task.priority}
                          </span>
                          <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-text-mid">
                            {task.assignee}
                          </span>
                          {task.fromMeeting && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-ai-500/10 px-2 py-0.5 text-[10px] text-ai-400">
                              <VideoIcon className="size-2.5" /> {task.fromMeeting}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => remove.mutate(task.id)}
                        className="text-text-lo opacity-0 transition-opacity hover:text-danger-500 group-hover:opacity-100"
                        aria-label="Delete task"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </article>
                ))}

                {byColumn[col.id].length === 0 && (
                  <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line py-6 text-xs text-text-lo">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <AddTaskDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddTaskDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const push = useToast((s) => s.push);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    assignee: "",
    status: "todo" as TaskStatus,
  });

  const create = useMutation({
    mutationFn: () =>
      taskApi.create({
        ...form,
        assignee: form.assignee.trim() || "Unassigned",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      push("Task created", "success");
      onClose();
    },
    onError: (err) => push(apiErrorMessage(err), "error"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return push("Give the task a title", "error");
    create.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card className="w-full max-w-md animate-rise p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text-hi">New task</h2>
          <button
            onClick={onClose}
            className="text-text-lo hover:text-text-hi"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              autoFocus
              placeholder="Finalize analytics charts"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              rows={2}
              placeholder="Optional details…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="t-status">Column</Label>
              <Select
                id="t-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-prio">Priority</Label>
              <Select
                id="t-prio"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-assignee">Assignee</Label>
              <Input
                id="t-assignee"
                placeholder="Name"
                value={form.assignee}
                onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner /> : "Create task"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
