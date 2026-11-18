"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFilters } from "./actions";
import { selectClassName } from "./task-form";
import {
  STATUS_LABELS,
  TASK_STATUSES,
  type FilterFields,
  type TaskFilters as Filters,
} from "./tasks";

// The parent keys this component by the saved filters, so it remounts with
// fresh default values after every successful save.
export function TaskFilters({ filters }: { filters: Filters }) {
  const [state, formAction, pending] = useActionState(saveFilters, {});

  const value = (field: FilterFields) =>
    state.values?.[field] ?? filters[field] ?? "";
  const fieldError = (field: FilterFields) =>
    state.fieldErrors?.[field] && (
      <p id={`filter-${field}-error`} className="text-sm text-destructive">
        {state.fieldErrors[field]}
      </p>
    );
  const errorProps = (field: FilterFields) => ({
    "aria-invalid": Boolean(state.fieldErrors?.[field]),
    "aria-describedby": state.fieldErrors?.[field]
      ? `filter-${field}-error`
      : undefined,
  });

  return (
    <form
      action={formAction}
      noValidate
      aria-label="Task filters"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-status_filter">Status</Label>
          <select
            id="filter-status_filter"
            name="status_filter"
            defaultValue={value("status_filter")}
            className={selectClassName}
            {...errorProps("status_filter")}
          >
            <option value="">All</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {fieldError("status_filter")}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-date_from">Due from</Label>
          <Input
            id="filter-date_from"
            name="date_from"
            type="date"
            defaultValue={value("date_from")}
            {...errorProps("date_from")}
          />
          {fieldError("date_from")}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-date_to">Due to</Label>
          <Input
            id="filter-date_to"
            name="date_to"
            type="date"
            defaultValue={value("date_to")}
            {...errorProps("date_to")}
          />
          {fieldError("date_to")}
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Applying…" : "Apply filters"}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="reset"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Reset filters
        </Button>
      </div>
    </form>
  );
}
