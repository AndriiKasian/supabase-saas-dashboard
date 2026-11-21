"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlusIcon } from "./icons";
import { TaskForm } from "./task-form";
import type { Task } from "./tasks";

// One dialog for creating (no `task`) and editing a task. It closes only
// when the form reports a successful save, or on Cancel / Escape.
export function TaskDialog({
  open,
  onOpenChange,
  task,
  finalFocus,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  finalFocus?: RefObject<HTMLElement | null>;
  onSaved?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {task ? "Update the task details." : "Add a task to your list."}
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          task={task}
          onDone={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

export function NewTaskButton() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  return (
    <>
      <Button
        ref={buttonRef}
        size="lg"
        className="h-10 shrink-0 gap-2 px-4 text-sm shadow-sm shadow-primary/25"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="size-4" />
        New task
      </Button>
      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        finalFocus={buttonRef}
        // New tasks appear first, so show page 1 after creating one.
        onSaved={() => router.push("/dashboard")}
      />
    </>
  );
}
