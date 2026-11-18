"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteTask, setTaskStatus } from "./actions";
import { TaskForm, selectClassName } from "./task-form";
import { STATUS_LABELS, TASK_STATUSES, type Task } from "./tasks";

export function TaskItem({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [statusState, statusAction, statusPending] = useActionState(
    setTaskStatus,
    {},
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTask,
    {},
  );

  if (editing) {
    return (
      <li className="rounded-lg border p-4">
        <TaskForm task={task} onDone={() => setEditing(false)} />
      </li>
    );
  }

  const error = statusState.error ?? deleteState.error;

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h3
          className={`font-medium break-words ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}
        >
          {task.title}
        </h3>
        {task.description && (
          <p className="text-sm whitespace-pre-line break-words text-muted-foreground">
            {task.description}
          </p>
        )}
        {task.due_date && (
          <p className="text-xs text-muted-foreground">Due {task.due_date}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={statusAction}>
          <input type="hidden" name="id" value={task.id} />
          <select
            name="status"
            aria-label="Status"
            defaultValue={task.status}
            key={task.status}
            disabled={statusPending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={selectClassName}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </form>

        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>

        {confirmingDelete ? (
          <form action={deleteAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={task.id} />
            <span className="text-sm">Delete this task?</span>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deletePending}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
