"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { updateUnit } from "@/app/(admin)/admin/properties/actions";
import { humanize } from "@/lib/format";

const STATUS_OPTIONS = ["occupied", "available", "make_ready", "offline"];

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export type UnitEditValues = {
  id: string;
  label: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  rent_cents: number | null;
  notes: string | null;
};

export function UnitEditForm({ unit }: { unit: UnitEditValues }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap text-xs font-medium text-pine hover:text-pine-dark"
      >
        Edit
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateUnit(formData);
        setOpen(false);
      }}
      className="space-y-4 rounded-xl border border-clay bg-white/70 p-4"
    >
      <input type="hidden" name="id" value={unit.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">Label</span>
          <input name="label" defaultValue={unit.label} className={inputClass} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">Status</span>
          <select name="status" defaultValue={unit.status} className={inputClass}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {humanize(o)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">Bedrooms</span>
          <input
            name="bedrooms"
            type="number"
            min="0"
            step="1"
            defaultValue={unit.bedrooms ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">Bathrooms</span>
          <input
            name="bathrooms"
            type="number"
            min="0"
            step="0.5"
            defaultValue={unit.bathrooms ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">Sq ft</span>
          <input
            name="sqft"
            type="number"
            min="0"
            step="1"
            defaultValue={unit.sqft ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-ink-soft">Monthly rent ($)</span>
        <input
          name="rent_dollars"
          type="number"
          min="0"
          step="1"
          defaultValue={unit.rent_cents == null ? "" : unit.rent_cents / 100}
          className={inputClass}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-ink-soft">Notes</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={unit.notes ?? ""}
          className={inputClass}
          placeholder="Internal notes about this unit…"
        />
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary">
          Save changes
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-medium text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
