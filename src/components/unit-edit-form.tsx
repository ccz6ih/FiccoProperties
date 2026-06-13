"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { saveUnit } from "@/app/(admin)/admin/properties/actions";
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

export type OccupancyValues = {
  occupant_profile_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
  rent_cents: number | null;
  lease_start_date: string | null;
  lease_signed_date: string | null;
  lease_end_date: string | null;
  move_in_date: string | null;
  notes: string | null;
};

export type ResidentOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function dollars(cents: number | null): string {
  return cents == null ? "" : String(cents / 100);
}

export function UnitEditForm({
  unit,
  occupancy,
  residents,
  propertySlug,
}: {
  unit: UnitEditValues;
  occupancy: OccupancyValues | null;
  residents: ResidentOption[];
  propertySlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="whitespace-nowrap text-xs font-medium text-pine hover:text-pine-dark"
    >
      Edit
    </button>
  );

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl bg-cream p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            Edit {unit.label}
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-sand"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form
          action={async (formData) => {
            await saveUnit(formData);
            setOpen(false);
          }}
          className="space-y-6"
        >
          <input type="hidden" name="id" value={unit.id} />
          <input type="hidden" name="property_slug" value={propertySlug} />

      {/* — Unit — */}
      <section className="space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Unit
        </h4>

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
          <span className="text-xs font-medium text-ink-soft">Listing rent ($)</span>
          <input
            name="rent_dollars"
            type="number"
            min="0"
            step="1"
            defaultValue={dollars(unit.rent_cents)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">Unit notes</span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={unit.notes ?? ""}
            className={inputClass}
            placeholder="Internal notes about this unit…"
          />
        </label>
      </section>

      {/* — Current tenancy — */}
      <section className="space-y-4 border-t border-clay pt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Current tenancy
        </h4>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">
            Occupant account (optional)
          </span>
          <select
            name="occupant_profile_id"
            defaultValue={occupancy?.occupant_profile_id ?? ""}
            className={inputClass}
          >
            <option value="">— none / link later —</option>
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {(r.full_name ?? "Unnamed")}
                {r.email ? ` — ${r.email}` : ""}
              </option>
            ))}
          </select>
          <span className="block text-[11px] leading-snug text-ink-faint">
            {residents.length === 0
              ? "No one has created a login yet, so leave this as ‘none’. It links automatically once the tenant signs up with the email below."
              : "Connects the tenant’s sign-in to this unit (their portal, maintenance, messages). It auto-links when the Tenant email below matches an account — or pick one here."}
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-soft">Tenant name</span>
            <input
              name="tenant_name"
              defaultValue={occupancy?.tenant_name ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-soft">Rent they pay ($)</span>
            <input
              name="tenant_rent_dollars"
              type="number"
              min="0"
              step="1"
              defaultValue={dollars(occupancy?.rent_cents ?? null)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-soft">Tenant email</span>
            <input
              name="tenant_email"
              type="email"
              defaultValue={occupancy?.tenant_email ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-soft">Tenant phone</span>
            <input
              name="tenant_phone"
              defaultValue={occupancy?.tenant_phone ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-soft">Lease start date</span>
            <input
              name="lease_start_date"
              type="date"
              defaultValue={occupancy?.lease_start_date ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-soft">Lease signed date</span>
            <input
              name="lease_signed_date"
              type="date"
              defaultValue={occupancy?.lease_signed_date ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-soft">Lease end date</span>
            <input
              name="lease_end_date"
              type="date"
              defaultValue={occupancy?.lease_end_date ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-soft">Move-in date</span>
            <input
              name="move_in_date"
              type="date"
              defaultValue={occupancy?.move_in_date ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">Tenancy notes</span>
          <textarea
            name="tenancy_notes"
            rows={2}
            defaultValue={occupancy?.notes ?? ""}
            className={inputClass}
            placeholder="Notes about the current tenant or lease…"
          />
        </label>
      </section>

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
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {open && mounted && createPortal(dialog, document.body)}
    </>
  );
}
