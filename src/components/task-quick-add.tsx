"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { createTask, type TaskState } from "@/app/(admin)/admin/tasks/actions";

const initial: TaskState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

const CATEGORIES = [
  "repair", "cleaning", "trash", "fence", "landscaping",
  "emergency", "inspection", "admin", "extra", "other",
];

export type StaffOpt = { id: string; name: string };
export type UnitOpt = { id: string; label: string; property: string };
export type PropOpt = { id: string; name: string };

export function TaskQuickAdd({
  staff,
  properties,
  units,
}: {
  staff: StaffOpt[];
  properties: PropOpt[];
  units: UnitOpt[];
}) {
  const [state, action, pending] = useActionState(createTask, initial);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  // Group units by property for the dropdown.
  const byProperty = new Map<string, UnitOpt[]>();
  for (const u of units) {
    const arr = byProperty.get(u.property) ?? [];
    arr.push(u);
    byProperty.set(u.property, arr);
  }

  if (!open) {
    return (
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        + New task
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-3 rounded-2xl border border-clay bg-cream p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink">New task</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Close
        </button>
      </div>

      <input
        name="title"
        required
        placeholder="What needs doing? (e.g. Fix fence at Unit 5)"
        className={field}
        autoFocus
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <select name="assignee_id" defaultValue="" className={field}>
          <option value="">Assign to…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select name="category" defaultValue="repair" className={field}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select name="property_id" defaultValue="" className={field}>
          <option value="">Community (optional)…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select name="unit_id" defaultValue="" className={field}>
          <option value="">Unit (optional)…</option>
          {[...byProperty.entries()].map(([prop, list]) => (
            <optgroup key={prop} label={prop}>
              {list.map((u) => (
                <option key={u.id} value={u.id}>{prop} · {u.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-faint">
          Due date
          <input type="date" name="due_date" className={field} />
        </label>
        <label className="text-xs text-ink-faint">
          Priority
          <select name="priority" defaultValue="normal" className={field}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>

      <textarea
        name="details"
        rows={2}
        placeholder="Notes (optional)…"
        className={field}
      />

      {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Adding…" : "Add task"}
      </Button>
    </form>
  );
}
