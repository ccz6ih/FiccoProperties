"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  createAdminMaintenanceRequest,
  type NewRequestState,
} from "@/app/(admin)/admin/maintenance/actions";

const initial: NewRequestState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

const CATEGORIES = [
  "general", "plumbing", "electrical", "hvac", "appliance",
  "exterior", "pest", "other",
];

export type MaintUnitOpt = { id: string; label: string; property: string };

export function MaintenanceQuickAdd({ units }: { units: MaintUnitOpt[] }) {
  const [state, action, pending] = useActionState(createAdminMaintenanceRequest, initial);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const byProperty = new Map<string, MaintUnitOpt[]>();
  for (const u of units) {
    const arr = byProperty.get(u.property) ?? [];
    arr.push(u);
    byProperty.set(u.property, arr);
  }

  if (!open) {
    return (
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        + New request
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="w-full max-w-md space-y-3 rounded-2xl border border-clay bg-cream p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink">New maintenance request</h3>
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
        placeholder="What's the issue? (e.g. Kitchen faucet leaking)"
        className={field}
        autoFocus
      />

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

      <div className="grid gap-3 sm:grid-cols-2">
        <select name="category" defaultValue="general" className={field}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </select>
        <select name="priority" defaultValue="normal" className={field}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="emergency">Emergency</option>
        </select>
      </div>

      <textarea
        name="description"
        rows={2}
        placeholder="Details (optional)…"
        className={field}
      />

      {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}
      {state.ok && <p className="text-xs text-pine">Added to the board ✓</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Adding…" : "Add request"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Done
        </button>
      </div>
    </form>
  );
}
