import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  charge_id: string | null;
  resident_id: string | null;
  amount_cents: number;
  status: string;
};
type ChargeRow = {
  id: string;
  lease_id: string | null;
  resident_id: string | null;
  status: string;
  description: string | null;
  period: string | null;
};

/**
 * Stripe webhook — finalises asynchronous ACH payments. When a bank debit
 * clears (payment_intent.succeeded) we mark the pending payment paid, post the
 * ledger entry, and flip the charge to paid; on failure we mark it failed and
 * leave the charge open. Signature-verified with STRIPE_WEBHOOK_SECRET.
 *
 * Register this URL in the Stripe dashboard once live:
 *   https://<your-domain>/api/webhooks/stripe
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Not configured yet — acknowledge so Stripe doesn't retry.
    return NextResponse.json({ ok: true, skipped: "webhook not configured" });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ ok: false, error: "No signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  const db = createAdminClient() as unknown as SupabaseClient;

  async function findPayment(providerRef: string): Promise<PaymentRow | null> {
    const { data } = await db
      .from("payments")
      .select("id, charge_id, resident_id, amount_cents, status")
      .eq("provider_ref", providerRef)
      .maybeSingle<PaymentRow>();
    return data ?? null;
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const payment = await findPayment(pi.id);
    if (payment && payment.status !== "succeeded" && payment.charge_id) {
      const { data: charge } = await db
        .from("charges")
        .select("id, lease_id, resident_id, status, description, period")
        .eq("id", payment.charge_id)
        .maybeSingle<ChargeRow>();

      await db.from("payments").update({ status: "succeeded" }).eq("id", payment.id);

      if (charge && charge.status !== "paid") {
        if (charge.resident_id) {
          await db.from("ledger_entries").insert({
            resident_id: charge.resident_id,
            lease_id: charge.lease_id,
            kind: "payment",
            amount_cents: -payment.amount_cents,
            ref_id: charge.id,
            memo: `Payment for ${charge.description ?? charge.period ?? "charge"}`,
          });
        }
        await db.from("charges").update({ status: "paid" }).eq("id", charge.id);
      }
    }
    return NextResponse.json({ ok: true, handled: "succeeded" });
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const payment = await findPayment(pi.id);
    if (payment && payment.status !== "failed") {
      await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
      // Charge is left open so it reappears as unpaid for follow-up.
    }
    return NextResponse.json({ ok: true, handled: "failed" });
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}
