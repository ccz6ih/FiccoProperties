"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  scheduleInspection,
  sendInspectionNotice,
  addInspectionItem,
  closeInspection,
  type InspectionState,
} from "@/app/(admin)/admin/inspections/actions";

const initial: InspectionState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export type UnitOpt = { id: string; label: string; property: string };

const KIND_OPTIONS: [string, string][] = [
  ["annual", "Annual inspection"],
  ["seasonal", "Seasonal check"],
  ["follow_up", "Follow-up visit"],
  ["move_in", "Move-in"],
  ["move_out", "Move-out"],
];

export function InspectionScheduleForm({ units }: { units: UnitOpt[] }) {
  const [state, action, pending] = useActionState(scheduleInspection, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const byProperty = new Map<string, UnitOpt[]>();
  for (const u of units) {
    const arr = byProperty.get(u.property) ?? [];
    arr.push(u);
    byProperty.set(u.property, arr);
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Unit</span>
          <select name="unit_id" defaultValue="" required className={field}>
            <option value="" disabled>Choose a unit…</option>
            {[...byProperty.entries()].map(([prop, list]) => (
              <optgroup key={prop} label={prop}>
                {list.map((u) => (
                  <option key={u.id} value={u.id}>{prop} · {u.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Type</span>
          <select name="kind" defaultValue="annual" className={field}>
            {KIND_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Date</span>
          <input type="date" name="scheduled_for" required className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Time window (optional)
          </span>
          <input name="time_window" placeholder="e.g. 9:00 am – 12:00 pm" className={field} />
        </label>
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Scheduling…" : "Schedule"}
        </Button>
      </div>
      {state.ok && state.notice && <p className="text-sm font-medium text-pine">{state.notice}</p>}
      {state.error && <p className="text-sm text-terracotta-dark">{state.error}</p>}
    </form>
  );
}

export function InspectionNoticeButton({ inspectionId }: { inspectionId: string }) {
  const [state, action, pending] = useActionState(sendInspectionNotice, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={inspectionId} />
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Sending…" : "Email entry notice"}
      </Button>
      {state.ok && state.notice && <span className="text-xs font-medium text-pine">{state.notice}</span>}
      {state.error && <span className="text-xs text-terracotta-dark">{state.error}</span>}
    </form>
  );
}

const AREAS = [
  "Kitchen", "Bathroom", "Bedroom", "Living room", "Floors & walls",
  "Windows & doors", "Smoke / CO detectors", "Plumbing", "Electrical",
  "Heating", "Exterior", "Other",
];

export function InspectionItemForm({ inspectionId }: { inspectionId: string }) {
  const [state, action, pending] = useActionState(addInspectionItem, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="inspection_id" value={inspectionId} />
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Area</span>
        <select name="area" defaultValue="Kitchen" className={field}>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Condition</span>
        <select name="condition" defaultValue="good" className={field}>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="needs_attention">Needs attention</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label className="min-w-44 flex-1 space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Note</span>
        <input name="note" placeholder="What you saw…" className={field} />
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Photo</span>
        <input
          type="file"
          name="photo"
          accept="image/*"
          className="block w-44 text-xs text-ink-soft file:mr-2 file:rounded-lg file:border-0 file:bg-pine file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-cream hover:file:bg-pine-dark"
        />
      </label>
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Adding…" : "Add finding"}
      </Button>
      {state.error && <span className="pb-2 text-xs text-terracotta-dark">{state.error}</span>}
    </form>
  );
}

export function InspectionCloseForm({ inspectionId }: { inspectionId: string }) {
  const [state, action, pending] = useActionState(closeInspection, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex items-center gap-4">
        <Button type="button" variant="primary" size="md" onClick={() => setOpen(true)}>
          Complete inspection…
        </Button>
        <form action={action}>
          <input type="hidden" name="id" value={inspectionId} />
          <input type="hidden" name="mode" value="cancel" />
          <button type="submit" className="text-xs font-medium text-ink-faint hover:text-terracotta-dark">
            Cancel this inspection
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={inspectionId} />
      <input type="hidden" name="mode" value="complete" />
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Overall summary
        </span>
        <textarea
          name="summary"
          rows={2}
          placeholder="e.g. Unit in good shape overall; two findings escalated to tasks."
          className={field}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : "Mark completed"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-soft hover:text-ink">
          Back
        </button>
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
