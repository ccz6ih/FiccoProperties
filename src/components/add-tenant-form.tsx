"use client";

import { useActionState, useState } from "react";
import { Card, Button } from "@/components/ui";
import { addTenant, type AddTenantState } from "@/app/(admin)/admin/tenants/actions";

export type UnitOption = {
  id: string;
  label: string;
  property: string;
  rentCents: number | null;
  occupiedBy: string | null;
};

export type ExistingTenant = {
  unitId: string;
  name: string | null;
  email: string | null;
  where: string;
};

const initial: AddTenantState = { ok: false };

const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";
const lbl = "block text-xs font-medium uppercase tracking-wide text-ink-faint";
const norm = (s: string) => s.trim().toLowerCase();

export function AddTenantForm({
  units,
  existing,
}: {
  units: UnitOption[];
  existing: ExistingTenant[];
}) {
  const [state, action, pending] = useActionState(addTenant, initial);
  const [rent, setRent] = useState("");
  const [unitId, setUnitId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function onUnit(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u && u.rentCents != null && !rent) setRent(String(u.rentCents / 100));
  }

  const selectedUnit = units.find((u) => u.id === unitId) ?? null;
  const overwrite = selectedUnit?.occupiedBy ?? null;

  // Same name/email already on another unit?
  const dupes = existing.filter(
    (e) =>
      e.unitId !== unitId &&
      ((name.trim() && e.name && norm(e.name) === norm(name)) ||
        (email.trim() && e.email && norm(e.email) === norm(email)))
  );

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
                {u.occupiedBy ? ` — occupied (${u.occupiedBy})` : ""}
                {u.rentCents != null ? ` — $${(u.rentCents / 100).toLocaleString()}` : ""}
              </option>
            ))}
          </select>
          {overwrite && (
            <p className="mt-2 rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 text-xs text-ink">
              ⚠️ This unit already has <strong>{overwrite}</strong> on file. Saving
              will <strong>replace</strong> that tenant&apos;s record. To edit them
              instead, open the unit and use Edit.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl} htmlFor="tenant_name">Tenant name</label>
            <input
              id="tenant_name"
              name="tenant_name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={lbl} htmlFor="tenant_phone">Phone</label>
            <input id="tenant_phone" name="tenant_phone" className={field} />
          </div>
        </div>

        {dupes.length > 0 && (
          <p className="rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 text-xs text-ink">
            ⚠️ Someone with this {dupes[0].name && norm(dupes[0].name) === norm(name) ? "name" : "email"} is
            already on file in{" "}
            <strong>{dupes.map((d) => d.where).join(", ")}</strong>. If that&apos;s
            the same person, edit them there instead of adding a duplicate.
          </p>
        )}

        <div>
          <label className={lbl} htmlFor="tenant_email">Email <span className="normal-case text-ink-faint">(optional)</span></label>
          <input
            id="tenant_email"
            name="tenant_email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
          <p className="mt-1 text-xs text-ink-faint">
            Optional — leave blank if they don&apos;t want a portal account. If the
            email already has an account, it&apos;s connected automatically.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-clay bg-sand/30 p-3">
          <input type="checkbox" name="invite" className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine" />
          <span className="text-sm text-ink-soft">
            <span className="font-medium text-ink">Invite to the resident portal</span> —
            create an account and email them a login (needs an email). Leave unticked
            to just keep records.
          </span>
        </label>
      </Card>

      {/* Lease & tenancy details (for the record) */}
      <Card className="space-y-4 p-6">
        <div>
          <span className={lbl}>Lease &amp; tenancy details</span>
          <p className="mt-1 text-xs text-ink-faint">
            For your records — dates, rent, and deposit from their current lease.
            Nothing here bills the tenant.
          </p>
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
          <div>
            <label className={lbl} htmlFor="lease_signed_date">Lease signed</label>
            <input id="lease_signed_date" name="lease_signed_date" type="date" className={field} />
          </div>
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
          {pending ? "Saving…" : "Save tenant record"}
        </Button>
        <span className="text-xs text-ink-faint">
          Saves their info to the unit. No account or billing unless you ask for it.
        </span>
      </div>
    </form>
  );
}
