"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { createRecurring, type RecurringState } from "@/app/(admin)/admin/recurring/actions";

const initial: RecurringState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** The patterns that cover nearly everything, so nobody ticks twelve boxes. */
const PRESETS: { label: string; months: number[] }[] = [
  { label: "Every month", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { label: "Quarterly", months: [1, 4, 7, 10] },
  { label: "Spring & autumn", months: [4, 10] },
  { label: "Once a year", months: [] },
];

export function RecurringForm({
  places,
  units,
  people,
}: {
  places: { id: string; name: string }[];
  units: { id: string; label: string }[];
  people: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createRecurring, initial);
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState<number[]>([4, 10]);
  const [scope, setScope] = useState<"property" | "unit">("property");

  if (!open) {
    return (
      <Button type="button" variant="primary" size="md" onClick={() => setOpen(true)}>
        + Add a recurring job
      </Button>
    );
  }

  const toggleMonth = (m: number) =>
    setMonths((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].sort((a, b) => a - b)));

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-clay bg-white p-5" key={state.ok ? "saved" : "editing"}>
      <div className="font-display text-lg font-semibold text-ink">New recurring job</div>

      <input name="title" required placeholder="Clean the gutters" className={field} />
      <input name="details" placeholder="Any detail (optional)" className={field} />

      {/* Where. A home or a whole community — not both, since a home is already
          at its community. */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "property" as const, label: "A whole community" },
          { key: "unit" as const, label: "One home" },
        ]).map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setScope(o.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              scope === o.key ? "border-pine bg-pine/5 text-pine" : "border-clay-deep text-ink-soft hover:bg-sand"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {scope === "property" ? (
        <select name="property_id" required className={field} defaultValue="">
          <option value="" disabled>Choose a community…</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      ) : (
        <select name="unit_id" required className={field} defaultValue="">
          <option value="" disabled>Choose a home…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
      )}

      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
          Which months
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setMonths(p.months)}
              className="rounded-lg border border-clay-deep px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-sand"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MONTHS.map((m, i) => {
            const n = i + 1;
            const on = months.includes(n);
            return (
              <label key={m} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="months"
                  value={n}
                  checked={on}
                  onChange={() => toggleMonth(n)}
                  className="sr-only"
                />
                <span
                  className={`inline-block rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    on ? "border-pine bg-pine text-cream" : "border-clay-deep text-ink-soft hover:bg-sand"
                  }`}
                >
                  {m}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="space-y-1">
          <span className="block text-xs text-ink-soft">Day of month</span>
          <input type="number" name="day_of_month" min={1} max={28} defaultValue={1} className={`${field} w-24`} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-ink-soft">Raise it this early</span>
          <select name="lead_days" defaultValue="14" className={field}>
            <option value="0">On the day</option>
            <option value="7">1 week before</option>
            <option value="14">2 weeks before</option>
            <option value="30">1 month before</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-ink-soft">Who</span>
          <select name="assignee_id" defaultValue="" className={field}>
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-ink-soft">Category</span>
          <select name="category" defaultValue="repair" className={field}>
            {["repair", "cleaning", "landscaping", "inspection", "trash", "fence", "admin", "other"].map((c) => (
              <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </label>
      </div>

      {state.error && <p className="text-sm text-terracotta-dark">{state.error}</p>}
      {state.ok && state.notice && <p className="text-sm font-medium text-pine">{state.notice}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : "Add it"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-faint hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
