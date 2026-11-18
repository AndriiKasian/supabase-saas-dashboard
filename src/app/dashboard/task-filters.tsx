"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveFilters } from "./actions";
import {
  STATUS_LABELS,
  TASK_STATUSES,
  type FilterFields,
  type TaskFilters as Filters,
} from "./tasks";

// Bordered box with a small label above a borderless native control; the
// focus ring is drawn on the box.
const fieldClassName =
  "flex min-w-0 flex-col gap-0.5 rounded-lg border border-input bg-card px-3 py-2 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-disabled:opacity-60";
const controlClassName =
  "w-full min-w-0 bg-transparent text-sm outline-none [color-scheme:light] dark:[color-scheme:dark] disabled:cursor-not-allowed";

// The parent keys this component by the saved filters, so it remounts with
// fresh default values after every successful save. `disabled` blocks saving
// when the saved filters could not be loaded.
export function TaskFilters({
  filters,
  disabled = false,
}: {
  filters: Filters;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveFilters, {});

  const id = (field: FilterFields) => `filter-${field}`;
  const value = (field: FilterFields) =>
    state.values?.[field] ?? filters[field] ?? "";
  const errorProps = (field: FilterFields) => ({
    "aria-invalid": Boolean(state.fieldErrors?.[field]),
    "aria-describedby": state.fieldErrors?.[field]
      ? `${id(field)}-error`
      : undefined,
  });
  const errors = (Object.keys(state.fieldErrors ?? {}) as FilterFields[]).map(
    (field) => (
      <p key={field} id={`${id(field)}-error`} className="text-sm text-destructive">
        {state.fieldErrors?.[field]}
      </p>
    ),
  );

  return (
    <form action={formAction} noValidate aria-label="Task filters">
      <fieldset disabled={disabled || pending} className="flex flex-col gap-2">
        <legend className="sr-only">Filter tasks</legend>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1.15fr_1fr_1fr_auto]">
          <label className={fieldClassName}>
            <span className="text-xs text-muted-foreground">Status</span>
            <select
              id={id("status_filter")}
              name="status_filter"
              defaultValue={value("status_filter")}
              className={controlClassName}
              {...errorProps("status_filter")}
            >
              <option value="">All statuses</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className={fieldClassName}>
            <span className="text-xs text-muted-foreground">Due from</span>
            <input
              id={id("date_from")}
              name="date_from"
              type="date"
              defaultValue={value("date_from")}
              className={controlClassName}
              {...errorProps("date_from")}
            />
          </label>

          <label className={fieldClassName}>
            <span className="text-xs text-muted-foreground">Due to</span>
            <input
              id={id("date_to")}
              name="date_to"
              type="date"
              defaultValue={value("date_to")}
              className={controlClassName}
              {...errorProps("date_to")}
            />
          </label>

          <div className="flex gap-3 sm:col-span-3 sm:justify-end lg:col-span-1 lg:self-center">
            <Button
              type="submit"
              variant="secondary"
              className="h-10 flex-1 px-6 font-semibold sm:flex-none"
            >
              {pending ? "Applying…" : "Apply"}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="reset"
              variant="outline"
              className="h-10 flex-1 px-6 font-semibold sm:flex-none"
            >
              Reset
            </Button>
          </div>
        </div>

        {errors}
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Due dates are inclusive. Tasks without a due date are hidden when a
          date is set.
        </p>
      </fieldset>
    </form>
  );
}
