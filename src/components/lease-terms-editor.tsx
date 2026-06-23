"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { buildLeaseTerms } from "@/lib/lease-template";
import { updateLeaseTerms, type LeaseTermsState } from "@/app/(admin)/admin/leases/actions";

const initial: LeaseTermsState = { ok: false };

export type LeaseRegenData = {
  tenantName: string | null;
  propertyName: string | null;
  unitLabel: string | null;
  rentDollars: string;
  depositDollars: string;
  startDate: string | null;
  endDate: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export function LeaseTermsEditor({
  leaseId,
  initialTerms,
  regen,
}: {
  leaseId: string;
  initialTerms: string | null;
  regen: LeaseRegenData;
}) {
  const [state, action, pending] = useActionState(updateLeaseTerms, initial);
  const [terms, setTerms] = useState(initialTerms ?? "");
  const [utilities, setUtilities] = useState<"standard" | "tenant" | "landlord">("standard");
  const [garage, setGarage] = useState(false);

  const townhome = ["The Villa", "Villa Victoria"].includes(regen.propertyName ?? "");

  function regenerate() {
    setTerms(
      buildLeaseTerms({
        tenantName: regen.tenantName,
        propertyName: regen.propertyName,
        unitLabel: regen.unitLabel,
        rentDollars: regen.rentDollars,
        depositDollars: regen.depositDollars,
        startDate: regen.startDate,
        endDate: regen.endDate,
        includeGarage: garage,
        includeTownhomeRules: townhome,
        utilities,
        addressLine1: regen.addressLine1,
        city: regen.city,
        state: regen.state,
        postalCode: regen.postalCode,
      })
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={leaseId} />
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
        <label className="flex items-center gap-1.5">
          Utilities
          <select
            value={utilities}
            onChange={(e) => setUtilities(e.target.value as "standard" | "tenant" | "landlord")}
            className="rounded-lg border border-clay-deep bg-white px-2 py-1"
          >
            <option value="standard">LL: water/sewer/trash · Tenant: elec/gas</option>
            <option value="tenant">Tenant pays all</option>
            <option value="landlord">Landlord pays all</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={garage}
            onChange={(e) => setGarage(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-clay-deep text-pine focus:ring-pine/30"
          />
          Garage clause
        </label>
        <button
          type="button"
          onClick={regenerate}
          className="rounded-full border border-clay-deep px-3 py-1 font-medium text-pine hover:bg-sand"
        >
          Regenerate standard terms
        </button>
        {townhome && <span className="text-ink-faint">Town home rules auto-included</span>}
      </div>

      <textarea
        name="terms"
        value={terms}
        onChange={(e) => setTerms(e.target.value)}
        rows={16}
        className="w-full rounded-xl border border-clay-deep bg-cream px-4 py-3 font-mono text-xs leading-relaxed text-ink"
      />

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save terms"}
        </Button>
        {state.ok && <span className="text-xs font-medium text-pine">✓ Saved</span>}
        {state.error && <span className="text-xs text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
