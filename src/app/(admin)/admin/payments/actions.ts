"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { formatCents } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminPaymentsState = { ok: boolean; error?: string; notice?: string };

/** Sum of succeeded payments already recorded against each of the given charges. */
async function paidByCharge(
  db: SupabaseClient,
  chargeIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (chargeIds.length === 0) return map;
  const { data } = await db
    .from("payments")
    .select("charge_id, amount_cents")
    .in("charge_id", chargeIds)
    .eq("status", "succeeded")
    .returns<{ charge_id: string | null; amount_cents: number }[]>();
  for (const p of data ?? []) {
    if (!p.charge_id) continue;
    map.set(p.charge_id, (map.get(p.charge_id) ?? 0) + p.amount_cents);
  }
  return map;
}

type OccupancyForBilling = {
  unit_id: string;
  occupant_profile_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  rent_cents: number | null;
  units: { rent_cents: number | null; property_id: string | null } | null;
};

type ActiveLeaseRow = {
  id: string;
  unit_id: string;
  resident_id: string;
  rent_cents: number;
};

type ExistingChargeRow = { unit_id: string | null };

type ChargeForPaymentRow = {
  id: string;
  resident_id: string | null;
  lease_id: string | null;
  unit_id: string | null;
  amount_cents: number;
  status: string;
  description: string | null;
  period: string | null;
};

/** "2026-07" -> due date "2026-07-01". */
function periodToDueDate(period: string): string {
  return `${period}-01`;
}

/**
 * Generate a rent charge for every OCCUPIED unit for the given period — billing
 * by occupancy, not just active leases, so record-only and month-to-month
 * tenants are included. Uses the active-lease rent/resident when there is one,
 * otherwise the tenancy's rent. Idempotent: units already charged for `period`
 * are skipped, so re-running never double-bills.
 */
export async function generateMonthlyCharges(
  _prev: AdminPaymentsState,
  form: FormData
): Promise<AdminPaymentsState> {
  const { profile } = await requireProfile("/admin/payments");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const period = (form.get("period") as string)?.trim();
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return { ok: false, error: "Pick a valid month (YYYY-MM)." };
  }

  // Optional: restrict billing to selected properties (e.g. just the townhomes).
  const propertyIds = form
    .getAll("property_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const propertyFilter = propertyIds.length > 0 ? new Set(propertyIds) : null;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const dueDate = periodToDueDate(period);

  // Occupied units (a tenancy with someone on it), their rent + fallback.
  const { data: occAll } = await db
    .from("unit_occupancy")
    .select("unit_id, occupant_profile_id, tenant_name, tenant_email, rent_cents, units(rent_cents, property_id)")
    .returns<OccupancyForBilling[]>();
  const occ = propertyFilter
    ? (occAll ?? []).filter(
        (o) => o.units?.property_id && propertyFilter.has(o.units.property_id)
      )
    : occAll;

  // Active leases give a resident/lease link + rent when present.
  const { data: leases } = await db
    .from("leases")
    .select("id, unit_id, resident_id, rent_cents")
    .eq("status", "active")
    .returns<ActiveLeaseRow[]>();
  const leaseByUnit = new Map<string, ActiveLeaseRow>();
  for (const l of leases ?? []) if (l.unit_id) leaseByUnit.set(l.unit_id, l);

  // Units already charged this period.
  const { data: existing } = await db
    .from("charges")
    .select("unit_id")
    .eq("period", period)
    .returns<ExistingChargeRow[]>();
  const billed = new Set((existing ?? []).map((c) => c.unit_id).filter(Boolean));

  const rows = (occ ?? [])
    .filter(
      (o) =>
        o.unit_id &&
        (o.tenant_name || o.tenant_email || o.occupant_profile_id) &&
        !billed.has(o.unit_id)
    )
    .map((o) => {
      const lease = leaseByUnit.get(o.unit_id);
      const rent = lease?.rent_cents || o.rent_cents || o.units?.rent_cents || 0;
      return {
        unit_id: o.unit_id,
        lease_id: lease?.id ?? null,
        resident_id: lease?.resident_id ?? o.occupant_profile_id ?? null,
        amount_cents: rent,
        description: "Monthly rent",
        due_date: dueDate,
        status: "open",
        period,
      };
    })
    .filter((r) => r.amount_cents > 0);

  if (rows.length === 0) {
    return {
      ok: true,
      notice: `Every occupied unit is already billed for ${period} (or none have a rent set).`,
    };
  }

  const { data: inserted, error } = await db
    .from("charges")
    .insert(rows)
    .select("id, unit_id, lease_id, resident_id, amount_cents")
    .returns<
      {
        id: string;
        unit_id: string;
        lease_id: string | null;
        resident_id: string | null;
        amount_cents: number;
      }[]
    >();

  if (error || !inserted) {
    return { ok: false, error: "Could not generate charges. Please try again." };
  }

  // Ledger entries only for account-linked charges (residents with a portal).
  const ledgerRows = inserted
    .filter((c) => c.resident_id)
    .map((c) => ({
      resident_id: c.resident_id,
      lease_id: c.lease_id,
      unit_id: c.unit_id,
      kind: "charge",
      amount_cents: c.amount_cents,
      ref_id: c.id,
      memo: `Rent — ${period}`,
    }));
  if (ledgerRows.length > 0) await db.from("ledger_entries").insert(ledgerRows);

  revalidatePath("/admin/payments");
  revalidatePath("/admin/rent-board");
  return {
    ok: true,
    notice: `Generated ${inserted.length} charge${
      inserted.length === 1 ? "" : "s"
    } for ${period}.`,
  };
}

/**
 * Mark several charges paid at once (the monthly "tick everyone who paid"
 * batch). Reads each charge amount from the DB, then inserts succeeded
 * payments + negative ledger entries and flips the charges to paid — all
 * server-side. Charges already paid/void are silently skipped.
 */
export async function recordOfflinePayments(
  _prev: AdminPaymentsState,
  form: FormData
): Promise<AdminPaymentsState> {
  const { profile } = await requireProfile("/admin/payments");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const ids = form
    .getAll("charge_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "No charges selected." };

  // Optional payment method + check/money-order number for the record.
  const method = (form.get("method") as string)?.trim() || null;
  const reference = (form.get("reference") as string)?.trim() || null;
  const refLabel = [method, reference].filter(Boolean).join(" ");
  const providerRef = refLabel || "offline";

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: charges } = await db
    .from("charges")
    .select("id, resident_id, lease_id, unit_id, amount_cents, status, description, period")
    .in("id", ids)
    .returns<ChargeForPaymentRow[]>();

  const billable = (charges ?? []).filter(
    (c) => c.status === "open" || c.status === "past_due"
  );
  if (billable.length === 0) {
    return { ok: false, error: "Those charges are already settled." };
  }

  // Pay the remaining balance (handles charges that were already part-paid).
  const priorPaid = await paidByCharge(db, billable.map((c) => c.id));
  const toSettle = billable
    .map((c) => ({ c, remaining: c.amount_cents - (priorPaid.get(c.id) ?? 0) }))
    .filter((x) => x.remaining > 0);
  if (toSettle.length === 0) {
    return { ok: false, error: "Those charges are already settled." };
  }

  const { error: payErr } = await db.from("payments").insert(
    toSettle.map(({ c, remaining }) => ({
      charge_id: c.id,
      resident_id: c.resident_id,
      unit_id: c.unit_id,
      amount_cents: remaining,
      method_id: null,
      provider_ref: providerRef,
      status: "succeeded",
    }))
  );
  if (payErr) return { ok: false, error: "Could not record the payments." };

  // Ledger only for account-linked charges (residents with a portal balance).
  const ledgerRows = toSettle
    .filter(({ c }) => c.resident_id)
    .map(({ c, remaining }) => ({
      resident_id: c.resident_id,
      lease_id: c.lease_id,
      unit_id: c.unit_id,
      kind: "payment",
      amount_cents: -remaining,
      ref_id: c.id,
      memo: `Offline payment${refLabel ? ` — ${refLabel}` : ""} — ${c.description ?? c.period ?? "charge"}`,
    }));
  if (ledgerRows.length > 0) await db.from("ledger_entries").insert(ledgerRows);

  await db
    .from("charges")
    .update({ status: "paid" })
    .in(
      "id",
      billable.map((c) => c.id)
    );

  revalidatePath("/admin/payments");
  return {
    ok: true,
    notice: `Marked ${billable.length} payment${
      billable.length === 1 ? "" : "s"
    } as paid.`,
  };
}

/**
 * Record a manual / offline payment against a charge (e.g. a mailed check).
 * Server-side and atomic: reads the charge amount from the DB, inserts a
 * succeeded payment + negative ledger entry, and marks the charge paid.
 */
export async function recordOfflinePayment(
  _prev: AdminPaymentsState,
  form: FormData
): Promise<AdminPaymentsState> {
  const { profile } = await requireProfile("/admin/payments");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const chargeId = (form.get("charge_id") as string)?.trim();
  if (!chargeId) return { ok: false, error: "Missing charge." };

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: charge } = await db
    .from("charges")
    .select("id, resident_id, lease_id, unit_id, amount_cents, status, description, period")
    .eq("id", chargeId)
    .maybeSingle<ChargeForPaymentRow>();

  if (!charge) return { ok: false, error: "Charge not found." };
  if (charge.status === "paid") return { ok: false, error: "Charge is already paid." };
  if (charge.status === "void") return { ok: false, error: "Charge has been voided." };

  const { error: payErr } = await db.from("payments").insert({
    charge_id: charge.id,
    resident_id: charge.resident_id,
    unit_id: charge.unit_id,
    amount_cents: charge.amount_cents,
    method_id: null,
    provider_ref: "offline",
    status: "succeeded",
  });
  if (payErr) return { ok: false, error: "Could not record the payment." };

  if (charge.resident_id) {
    await db.from("ledger_entries").insert({
      resident_id: charge.resident_id,
      lease_id: charge.lease_id,
      unit_id: charge.unit_id,
      kind: "payment",
      amount_cents: -charge.amount_cents,
      ref_id: charge.id,
      memo: `Offline payment — ${charge.description ?? charge.period ?? "charge"}`,
    });
  }

  await db.from("charges").update({ status: "paid" }).eq("id", charge.id);

  revalidatePath("/admin/payments");
  revalidatePath("/admin/rent-board");
  return { ok: true, notice: "Offline payment recorded." };
}

/**
 * Record a payment of a SPECIFIC amount against one charge — for short/partial
 * payments and overpayments. The charge is only marked paid once total recorded
 * payments cover it; an overpayment leaves a credit on the resident's ledger.
 */
export async function recordManualPayment(
  _prev: AdminPaymentsState,
  form: FormData
): Promise<AdminPaymentsState> {
  const { profile } = await requireProfile("/admin/payments");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const chargeId = (form.get("charge_id") as string)?.trim();
  const amountDollars = Number(form.get("amount_dollars"));
  if (!chargeId) return { ok: false, error: "Missing charge." };
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { ok: false, error: "Enter a valid amount." };
  }
  const amountCents = Math.round(amountDollars * 100);

  const method = (form.get("method") as string)?.trim() || null;
  const reference = (form.get("reference") as string)?.trim() || null;
  const refLabel = [method, reference].filter(Boolean).join(" ");
  const providerRef = refLabel || "offline";

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: charge } = await db
    .from("charges")
    .select("id, resident_id, lease_id, unit_id, amount_cents, status, description, period")
    .eq("id", chargeId)
    .maybeSingle<ChargeForPaymentRow>();
  if (!charge) return { ok: false, error: "Charge not found." };
  if (charge.status === "void") return { ok: false, error: "Charge has been voided." };

  const prior = (await paidByCharge(db, [charge.id])).get(charge.id) ?? 0;

  const { error: payErr } = await db.from("payments").insert({
    charge_id: charge.id,
    resident_id: charge.resident_id,
    unit_id: charge.unit_id,
    amount_cents: amountCents,
    method_id: null,
    provider_ref: providerRef,
    status: "succeeded",
  });
  if (payErr) return { ok: false, error: "Could not record the payment." };

  if (charge.resident_id) {
    await db.from("ledger_entries").insert({
      resident_id: charge.resident_id,
      lease_id: charge.lease_id,
      unit_id: charge.unit_id,
      kind: "payment",
      amount_cents: -amountCents,
      ref_id: charge.id,
      memo: `Offline payment${refLabel ? ` — ${refLabel}` : ""} — ${charge.description ?? charge.period ?? "charge"}`,
    });
  }

  const totalPaid = prior + amountCents;
  if (totalPaid >= charge.amount_cents) {
    await db.from("charges").update({ status: "paid" }).eq("id", charge.id);
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/rent-board");

  const remaining = charge.amount_cents - totalPaid;
  const notice =
    remaining > 0
      ? `Recorded ${formatCents(amountCents)} — ${formatCents(remaining)} still due.`
      : remaining < 0
        ? `Recorded ${formatCents(amountCents)} — paid in full with a ${formatCents(-remaining)} credit.`
        : `Recorded ${formatCents(amountCents)} — paid in full.`;
  return { ok: true, notice };
}
