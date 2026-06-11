"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/payments/provider";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentsState = { ok: boolean; error?: string; notice?: string };

type ChargeRow = {
  id: string;
  resident_id: string;
  lease_id: string;
  amount_cents: number;
  status: string;
  period: string | null;
  description: string | null;
};

type MethodRow = {
  id: string;
  profile_id: string;
  provider_ref: string | null;
  label: string | null;
};

/** Add a bank account (ACH, mock) for the signed-in resident. */
export async function addPaymentMethod(
  _prev: PaymentsState,
  form: FormData
): Promise<PaymentsState> {
  const kind = (form.get("kind") as string) === "card" ? "card" : "ach";
  const last4 = (form.get("last4") as string)?.trim();
  const nickname = (form.get("nickname") as string)?.trim();

  if (!last4 || !/^\d{4}$/.test(last4)) {
    return { ok: false, error: "Enter the last 4 digits of your account." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const label =
    nickname ||
    `${kind === "card" ? "Card" : "Checking"} ••${last4}`;

  // Tokenize through the provider (mock returns a fake ref).
  const provider = getProvider();
  const { providerRef } = await provider.createPaymentMethod({
    profileId: user.id,
    kind,
    label,
  });

  const db = supabase as unknown as SupabaseClient;

  // First method becomes the default.
  const { count } = await db
    .from("payment_methods")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  const { error } = await db.from("payment_methods").insert({
    profile_id: user.id,
    kind,
    label,
    provider_ref: providerRef,
    is_default: (count ?? 0) === 0,
  });

  if (error) return { ok: false, error: "Could not save your bank account. Please try again." };

  revalidatePath("/portal/payments");
  return { ok: true, notice: "Bank account added." };
}

/**
 * Pay a single open charge.
 *
 * Atomic and fully server-side: the amount is read from the DB (never trusted
 * from the client), the provider is charged, and on success we insert the
 * payment + a negative ledger entry and flip the charge to `paid`.
 */
export async function payCharge(
  _prev: PaymentsState,
  form: FormData
): Promise<PaymentsState> {
  const chargeId = (form.get("charge_id") as string)?.trim();
  const methodId = (form.get("method_id") as string)?.trim() || null;
  if (!chargeId) return { ok: false, error: "Missing charge." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  // The typed client doesn't know the new tables until types are regenerated;
  // use a loosely-typed handle (per CONVENTIONS.md). RLS still enforces access.
  const db = supabase as unknown as SupabaseClient;

  // Read the authoritative charge from the DB. RLS guarantees the resident can
  // only select their own charge, so this also enforces ownership.
  const { data: charge } = await db
    .from("charges")
    .select("id, resident_id, lease_id, amount_cents, status, period, description")
    .eq("id", chargeId)
    .eq("resident_id", user.id)
    .maybeSingle<ChargeRow>();

  if (!charge) return { ok: false, error: "Charge not found." };
  if (charge.status === "paid") return { ok: false, error: "This charge is already paid." };
  if (charge.status === "void") return { ok: false, error: "This charge has been voided." };

  // Resolve the payment method ref (mock provider just needs the token).
  let methodRef: string | null = null;
  if (methodId) {
    const { data: method } = await db
      .from("payment_methods")
      .select("id, profile_id, provider_ref, label")
      .eq("id", methodId)
      .eq("profile_id", user.id)
      .maybeSingle<MethodRow>();
    if (!method) return { ok: false, error: "Payment method not found." };
    methodRef = method.provider_ref;
  }

  const amountCents = charge.amount_cents;

  const provider = getProvider();
  const result = await provider.charge({
    amountCents,
    methodRef,
    description: charge.description ?? `Rent — ${charge.period ?? ""}`.trim(),
  });

  if (result.status !== "succeeded") {
    // Record the failed attempt for the history table; charge stays open.
    await db.from("payments").insert({
      charge_id: charge.id,
      resident_id: user.id,
      amount_cents: amountCents,
      method_id: methodId,
      provider_ref: result.providerRef,
      status: "failed",
    });
    revalidatePath("/portal/payments");
    return { ok: false, error: "The payment didn't go through. Please try again." };
  }

  // Success: settle atomically via a SECURITY DEFINER function. RLS makes the
  // charges UPDATE staff-only, so a resident can't flip their own charge to
  // 'paid' directly — settle_charge() does the payment row + negative ledger
  // entry + charge update in one call, re-checking ownership server-side.
  const { error: settleErr } = await db.rpc("settle_charge", {
    p_charge_id: charge.id,
    p_method_id: methodId,
    p_provider_ref: result.providerRef,
  });
  if (settleErr) return { ok: false, error: "Could not record your payment. Please try again." };

  revalidatePath("/portal/payments");
  revalidatePath("/portal");
  return { ok: true, notice: "Payment received — thank you!" };
}
