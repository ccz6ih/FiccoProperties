"use client";

import { useActionState, useState } from "react";
import { Card, Button } from "@/components/ui";
import { addTenant, type AddTenantState } from "@/app/(admin)/admin/tenants/actions";

export type UnitOption = {
  id: string;
  label: string;
  property: string;
  rentCents: number | null;
};

const initial: AddTenantState = { ok: false };

const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";
const lbl = "block text-xs font-medium uppercase tracking-wide text-ink-faint";

export function AddTenantForm({ units }: { units: UnitOption[] }) {
  const [state, action, pending] = useActionState(addTenant, initial);
  const [leaseType, setLeaseType] = useState<"existing" | "new">("existing");
  const [rent, setRent] = useState("");

  function onUnit(e: React.ChangeEvent<HTMLSelectElement>) {
    const u = units.find((x) => x.id === e.target.value);
    if (u && u.rentCents != null && !rent) setRent(String(u.rentCents / 100));
  }

  return (
    <form action={action} className="space-y-6">
      <Card className="space-y-5 p-6">
        <div>
          <label className={lbl} htmlFor="unit_id">
            Unit
          </label>
          <select id="unit_id" name="unit_id" required className={field} onChange={onUnit} defaultValue="">
            <option value="" disabled>
              Choose a unit…
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.property} · {u.label}
                {u.rentCents != null ? ` — $${(u.rentCents / 100).toLocaleString()}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl} htmlFor="tenant_name">Tenant name</label>
            <input id="tenant_name" name="tenant_name" required className={field} />
          </div>
          <div>
            <label className={lbl} htmlFor="tenant_phone">Phone</label>
            <input id="tenant_phone" name="tenant_phone" className={field} />
          </div>
        </div>

        <div>
          <label className={lbl} htmlFor="tenant_email">Email</label>
          <input id="tenant_email" name="tenant_email" type="email" className={field} />
          <p className="mt-1 text-xs text-ink-faint">
            Needed to set up billing — an active lease requires a portal account. The
            account is created quietly; invite them to the portal when you&apos;re ready.
          </p>
        </div>
      </Card>

      {/* Lease type */}
      <Card className="space-y-4 p-6">
        <span className={lbl}>Lease</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { v: "existing", t: "Existing lease", d: "Already signed on paper. Creates an active, billable lease now." },
            { v: "new", t: "New lease", d: "Draft a lease and send it to the resident to e-sign." },
          ].map((o) => (
            <label
              key={o.v}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                leaseType === o.v
                  ? "border-pine bg-pine/5"
                  : "border-clay hover:bg-sand/40"
              }`}
            >
              <input
                type="radio"
                name="lease_type"
                value={o.v}
                checked={leaseType === o.v}
                onChange={() => setLeaseType(o.v as "existing" | "new")}
                className="sr-only"
              />
              <div className="text-sm font-semibold text-ink">{o.t}</div>
              <div className="mt-1 text-xs text-ink-soft">{o.d}</div>
            </label>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl} htmlFor="rent">Monthly rent ($)</label>
            <input
              id="rent"
              name="rent"
              inputMode="decimal"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={lbl} htmlFor="deposit">Deposit ($)</label>
            <input id="deposit" name="deposit" inputMode="decimal" className={field} />
          </div>
          <div>
            <label className={lbl} htmlFor="move_in_date">Move-in date</label>
            <input id="move_in_date" name="move_in_date" type="date" className={field} />
          </div>
          <div>
            <label className={lbl} htmlFor="lease_start_date">Lease start</label>
            <input id="lease_start_date" name="lease_start_date" type="date" className={field} />
          </div>
          {leaseType === "existing" && (
            <div>
              <label className={lbl} htmlFor="lease_signed_date">Lease signed</label>
              <input id="lease_signed_date" name="lease_signed_date" type="date" className={field} />
            </div>
          )}
          <div>
            <label className={lbl} htmlFor="lease_end_date">Lease end</label>
            <input id="lease_end_date" name="lease_end_date" type="date" className={field} />
          </div>
        </div>

        <div>
          <label className={lbl} htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={2} className={field} />
        </div>
      </Card>

      {state.error && (
        <p className="rounded-lg border border-terracotta/40 bg-terracotta-soft/40 px-4 py-2 text-sm text-terracotta-dark">
          {state.error}
        </p>
      )}
      {state.ok && state.notice && (
        <p className="rounded-lg border border-pine/30 bg-pine/5 px-4 py-2 text-sm text-ink">
          ✓ {state.notice}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending
            ? "Saving…"
            : leaseType === "new"
              ? "Add tenant & draft lease"
              : "Add tenant"}
        </Button>
        <span className="text-xs text-ink-faint">
          {leaseType === "new"
            ? "You'll be taken to the lease to send for signature."
            : "Creates an active lease — ready to bill."}
        </span>
      </div>
    </form>
  );
}
