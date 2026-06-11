"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import { createLease, type LeaseFormState } from "@/app/(admin)/admin/leases/actions";

const initial: LeaseFormState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export type UnitOption = {
  id: string;
  label: string;
  property_name: string | null;
  rent_cents: number | null;
};

export type ResidentOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export function LeaseCreateForm({
  units,
  residents,
  defaults,
}: {
  units: UnitOption[];
  residents: ResidentOption[];
  defaults?: {
    unit_id?: string | null;
    resident_id?: string | null;
    rent?: string;
    application_id?: string | null;
  };
}) {
  const [state, action, pending] = useActionState(createLease, initial);

  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}

        {defaults?.application_id && (
          <input type="hidden" name="application_id" value={defaults.application_id} />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Unit</span>
            <select
              name="unit_id"
              className={inputClass}
              defaultValue={defaults?.unit_id ?? ""}
            >
              <option value="" disabled>
                Choose a unit…
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.property_name} · {u.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Resident</span>
            <select
              name="resident_id"
              className={inputClass}
              defaultValue={defaults?.resident_id ?? ""}
            >
              <option value="" disabled>
                Choose a resident…
              </option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name ?? "Unnamed"}
                  {r.email ? ` (${r.email})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Start date</span>
            <input type="date" name="start_date" className={inputClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">End date (optional)</span>
            <input type="date" name="end_date" className={inputClass} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Monthly rent (USD)</span>
            <input
              type="number"
              name="rent"
              min="0"
              step="1"
              className={inputClass}
              placeholder="1450"
              defaultValue={defaults?.rent ?? ""}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Security deposit (USD)</span>
            <input
              type="number"
              name="deposit"
              min="0"
              step="1"
              className={inputClass}
              placeholder="1450"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Lease terms</span>
          <textarea
            name="terms"
            rows={10}
            className={inputClass}
            placeholder="Paste or write the full lease agreement the resident will read and sign…"
          />
        </label>

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create draft lease"}
        </Button>
      </form>
    </Card>
  );
}
