"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { createLease, type LeaseFormState } from "@/app/(admin)/admin/leases/actions";
import { buildLeaseTerms } from "@/lib/lease-template";

const initial: LeaseFormState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export type UnitOption = {
  id: string;
  label: string;
  property_name: string | null;
  rent_cents: number | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
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
  const [terms, setTerms] = useState("");
  const [unitId, setUnitId] = useState(defaults?.unit_id ?? "");
  const [includeGarage, setIncludeGarage] = useState(false);
  const [utilities, setUtilities] = useState<"standard" | "tenant" | "landlord">("standard");
  const [tenancyType, setTenancyType] = useState<"fixed" | "month_to_month">("fixed");
  const formRef = useRef<HTMLFormElement>(null);

  // Warn if the generated/edited terms don't name the selected unit.
  const selectedUnit = units.find((u) => u.id === unitId);
  const escaped = (selectedUnit?.label ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const unitInTerms =
    !selectedUnit || new RegExp(`(^|[^0-9A-Za-z])${escaped}([^0-9A-Za-z]|$)`).test(terms);
  const termsMismatch = !!terms.trim() && !!selectedUnit && !unitInTerms;

  function fillStandardTerms() {
    const f = formRef.current;
    if (!f) return;
    const val = (name: string) =>
      (f.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "";
    const unit = units.find((u) => u.id === val("unit_id"));
    const resident = residents.find((r) => r.id === val("resident_id"));
    const townhome = ["The Villa", "Villa Victoria"].includes(unit?.property_name ?? "");
    setTerms(
      buildLeaseTerms({
        tenantName: resident?.full_name,
        propertyName: unit?.property_name,
        unitLabel: unit?.label,
        rentDollars: val("rent"),
        depositDollars: val("deposit"),
        startDate: val("start_date"),
        endDate: tenancyType === "month_to_month" ? null : val("end_date"),
        tenancyType,
        includeGarage,
        includeTownhomeRules: townhome,
        utilities,
        addressLine1: unit?.address_line1,
        city: unit?.city,
        state: unit?.state,
        postalCode: unit?.postal_code,
        adults: val("adults"),
        children: val("children"),
        appliances: val("appliances"),
      })
    );
  }

  return (
    <Card className="p-6">
      <form ref={formRef} action={action} className="space-y-4">
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
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
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

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Agreement type</span>
          <div className="flex flex-wrap gap-2">
            {([
              ["fixed", "Fixed term (has an end date)"],
              ["month_to_month", "Month-to-month (no end date)"],
            ] as const).map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTenancyType(value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  tenancyType === value
                    ? "border-pine bg-pine text-cream"
                    : "border-clay-deep bg-white/70 text-ink-soft hover:bg-sand"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-faint">
            Month-to-month swaps in Colorado&apos;s periodic-tenancy terms: 60-day notice for a
            rent change (one per 12 months), the C.R.S. 13-40-107 notice schedule to end it, and
            the &ldquo;for cause&rdquo; protections for residents of 12 months or more.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Start date</span>
            <input type="date" name="start_date" className={inputClass} />
          </label>
          {tenancyType === "fixed" ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">End date (optional)</span>
              <input type="date" name="end_date" className={inputClass} />
            </label>
          ) : (
            <div className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">End date</span>
              <div className="rounded-xl border border-clay bg-sand/40 px-4 py-2.5 text-sm text-ink-soft">
                None — continues month to month
              </div>
            </div>
          )}
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

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Adults</span>
            <input type="number" name="adults" min="0" step="1" className={inputClass} placeholder="1" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Children</span>
            <input type="number" name="children" min="0" step="1" className={inputClass} placeholder="0" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Appliances included</span>
            <input
              name="appliances"
              defaultValue="a range/stove, a refrigerator, and a dishwasher"
              className={inputClass}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">Lease terms</span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                Utilities
                <select
                  value={utilities}
                  onChange={(e) => setUtilities(e.target.value as "standard" | "tenant" | "landlord")}
                  className="rounded-lg border border-clay-deep bg-white px-2 py-1 text-xs text-ink"
                >
                  <option value="standard">LL: water/sewer/trash · Tenant: elec/gas</option>
                  <option value="tenant">Tenant pays all</option>
                  <option value="landlord">Landlord pays all</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={includeGarage}
                  onChange={(e) => setIncludeGarage(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-clay-deep text-pine focus:ring-pine/30"
                />
                Garage clause (Villa Victoria house)
              </label>
              <button
                type="button"
                onClick={fillStandardTerms}
                className="whitespace-nowrap rounded-full border border-clay-deep px-3 py-1 text-xs font-medium text-pine hover:bg-sand"
              >
                Fill standard 38th Ave terms
              </button>
            </div>
          </div>
          <textarea
            name="terms"
            rows={12}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className={inputClass}
            placeholder="Click “Fill standard 38th Ave terms” to generate the lease from the fields above, then edit as needed — or paste your own."
          />
          <span className="block text-[11px] text-ink-faint">
            Auto-fills tenant, unit, rent, dates &amp; deposit from the fields above plus the
            standard rules. Review/edit before sending; have your attorney review the template once.
          </span>
          {termsMismatch && (
            <div className="mt-1.5 rounded-lg border border-terracotta/40 bg-terracotta-soft px-3 py-2 text-xs text-terracotta-dark">
              ⚠ The terms don&apos;t mention <strong>{selectedUnit?.label}</strong> — the unit you picked.
              Click <span className="font-medium">“Fill standard 38th Ave terms”</span> to regenerate, or
              check the premises address in the terms.
            </div>
          )}
        </label>

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create draft lease"}
        </Button>
      </form>
    </Card>
  );
}
