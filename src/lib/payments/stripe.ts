/**
 * Stripe ACH provider. DORMANT until PAYMENTS_PROVIDER=stripe and the keys are
 * set — getProvider() returns the mock otherwise, so nothing here runs in
 * production until you deliberately switch it on.
 *
 * Env:
 *   PAYMENTS_PROVIDER=stripe
 *   STRIPE_SECRET_KEY               sk_test_… (test) / sk_live_… (live)
 *   STRIPE_WEBHOOK_SECRET           whsec_…  (from the webhook endpoint)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  pk_test_… / pk_live_…  (client bank-link UI)
 *
 * ACH is asynchronous: a bank debit returns "processing" and settles 1–5
 * business days later, so settlement is finalised by the webhook, not here.
 */
import type Stripe from "stripe";
import type { PaymentProvider, ChargeResult } from "./provider";

let client: Stripe | null = null;

/** Construct (once) the Stripe SDK client from the secret key. */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // Lazy require so the SDK isn't bundled unless Stripe is actually enabled.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StripeCtor = require("stripe") as typeof import("stripe").default;
  // Use the SDK's pinned API version (no explicit apiVersion to avoid type drift).
  client = new StripeCtor(key);
  return client;
}

/** Whether Stripe is running against live keys (vs test). */
export function isLiveMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live");
}

/** Map a Stripe PaymentIntent status to our ChargeResult status. */
export function mapIntentStatus(status: string): ChargeResult["status"] {
  if (status === "succeeded") return "succeeded";
  if (status === "processing") return "processing";
  return "failed";
}

/**
 * Create a SetupIntent so the resident can link a bank account (ACH) from the
 * portal via Stripe's Financial Connections UI. The client confirms this with
 * the publishable key; on success Stripe attaches a us_bank_account payment
 * method to the customer, which we then store as payment_methods.provider_ref.
 * (Client wiring is the final go-live step — see docs/STRIPE_SETUP.md.)
 */
export async function createBankSetupIntent(customerId: string): Promise<{ clientSecret: string }> {
  const stripe = getStripe();
  const si = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["us_bank_account"],
  });
  return { clientSecret: si.client_secret ?? "" };
}

/** Find-or-create the Stripe customer for a resident profile (idempotent by metadata). */
export async function ensureCustomer(profileId: string, label?: string): Promise<string> {
  const stripe = getStripe();
  const existing = await stripe.customers.search({
    query: `metadata['profile_id']:'${profileId}'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0].id;
  const created = await stripe.customers.create({
    name: label,
    metadata: { profile_id: profileId },
  });
  return created.id;
}

export const stripeProvider: PaymentProvider = {
  async createPaymentMethod({ profileId, label }) {
    // For ACH the actual bank account is linked client-side via a SetupIntent +
    // Financial Connections; the server can't tokenize it directly. We ensure a
    // customer here; the client flow attaches the bank method and passes the
    // pm_… id back to persist as provider_ref.
    const customerId = await ensureCustomer(profileId, label);
    return { providerRef: customerId };
  },

  async charge({ amountCents, methodRef, description }): Promise<ChargeResult> {
    const stripe = getStripe();
    if (!methodRef) return { providerRef: "", status: "failed" };
    try {
      const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        payment_method: methodRef,
        payment_method_types: ["us_bank_account"],
        confirm: true,
        off_session: true,
        description,
      });
      return { providerRef: pi.id, status: mapIntentStatus(pi.status) };
    } catch (err) {
      const anyErr = err as { payment_intent?: { id?: string } };
      return { providerRef: anyErr.payment_intent?.id ?? "", status: "failed" };
    }
  },
};
