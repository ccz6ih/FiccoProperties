"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminPaymentsState = { ok: boolean; error?: string; notice?: string };

type ActiveLeaseRow = {
  id: string;
  resident_id: string;
  rent_cents: number;
};

type ExistingChargeRow = { lease_id: string };

type ChargeForPaymentRow = {
  id: string;
  resident_id: string;
  lease_id: string;
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
 * Generate a rent charge for every active lease for the given period.
 * Idempotent: leases that already have a charge for `period` are skipped, so
 * re-running the action never double-bills.
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

  const supabase = await createClient();
  // `charges`/`ledger_entries` aren't in the generated types yet; use a loose
  // handle (per CONVENTIONS.md). RLS + the staff check above still apply.
  const db = supabase as unknown as SupabaseClient;

  const { data: leases } = await supabase
    .from("leases")
    .select("id, resident_id, rent_cents")
    .eq("status", "active")
    .returns<ActiveLeaseRow[]>();

  if (!leases || leases.length === 0) {
    return { ok: false, error: "No active leases to bill." };
  }

  // Skip leases that already have a charge for this period.
  const { data: existing } = await db
    .from("charges")
    .select("lease_id")
    .eq("period", period)
    .returns<ExistingChargeRow[]>();

  const billed = new Set((existing ?? []).map((c) => c.lease_id));
  const dueDate = periodToDueDate(period);

  const rows = leases
    .filter((l) => !billed.has(l.id) && l.rent_cents > 0)
    .map((l) => ({
      lease_id: l.id,
      resident_id: l.resident_id,
      amount_cents: l.rent_cents,
      description: "Monthly rent",
      due_date: dueDate,
      status: "open",
      period,
    }));

  if (rows.length === 0) {
    return { ok: true, notice: `All active leases already billed for ${period}.` };
  }

  const { data: inserted, error } = await db
    .from("charges")
    .insert(rows)
    .select("id, lease_id, resident_id, amount_cents")
    .returns<
      { id: string; lease_id: string; resident_id: string; amount_cents: number }[]
    >();

  if (error || !inserted) {
    return { ok: false, error: "Could not generate charges. Please try again." };
  }

  // Mirror each charge as a positive ledger entry (a debit the resident owes).
  await db.from("ledger_entries").insert(
    inserted.map((c) => ({
      resident_id: c.resident_id,
      lease_id: c.lease_id,
      kind: "charge",
      amount_cents: c.amount_cents,
      ref_id: c.id,
      memo: `Rent — ${period}`,
    }))
  );

  revalidatePath("/admin/payments");
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

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: charges } = await db
    .from("charges")
    .select("id, resident_id, lease_id, amount_cents, status, description, period")
    .in("id", ids)
    .returns<ChargeForPaymentRow[]>();

  const billable = (charges ?? []).filter(
    (c) => c.status === "open" || c.status === "past_due"
  );
  if (billable.length === 0) {
    return { ok: false, error: "Those charges are already settled." };
  }

  const { error: payErr } = await db.from("payments").insert(
    billable.map((c) => ({
      charge_id: c.id,
      resident_id: c.resident_id,
      amount_cents: c.amount_cents,
      method_id: null,
      provider_ref: "offline",
      status: "succeeded",
    }))
  );
  if (payErr) return { ok: false, error: "Could not record the payments." };

  await db.from("ledger_entries").insert(
    billable.map((c) => ({
      resident_id: c.resident_id,
      lease_id: c.lease_id,
      kind: "payment",
      amount_cents: -c.amount_cents,
      ref_id: c.id,
      memo: `Offline payment — ${c.description ?? c.period ?? "charge"}`,
    }))
  );

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
    .select("id, resident_id, lease_id, amount_cents, status, description, period")
    .eq("id", chargeId)
    .maybeSingle<ChargeForPaymentRow>();

  if (!charge) return { ok: false, error: "Charge not found." };
  if (charge.status === "paid") return { ok: false, error: "Charge is already paid." };
  if (charge.status === "void") return { ok: false, error: "Charge has been voided." };

  const { error: payErr } = await db.from("payments").insert({
    charge_id: charge.id,
    resident_id: charge.resident_id,
    amount_cents: charge.amount_cents,
    method_id: null,
    provider_ref: "offline",
    status: "succeeded",
  });
  if (payErr) return { ok: false, error: "Could not record the payment." };

  await db.from("ledger_entries").insert({
    resident_id: charge.resident_id,
    lease_id: charge.lease_id,
    kind: "payment",
    amount_cents: -charge.amount_cents,
    ref_id: charge.id,
    memo: `Offline payment — ${charge.description ?? charge.period ?? "charge"}`,
  });

  await db.from("charges").update({ status: "paid" }).eq("id", charge.id);

  revalidatePath("/admin/payments");
  return { ok: true, notice: "Offline payment recorded." };
}
