/**
 * Pluggable payment provider.
 *
 * The app talks to payments only through this interface so the underlying
 * processor (Stripe / Plaid / etc.) can be swapped without touching call sites.
 * Today `getProvider()` returns a synchronous in-memory MOCK that fakes
 * provider references and always succeeds — no network, no real keys.
 *
 * To wire a real provider later, implement `PaymentProvider` against the SDK,
 * read its keys from env (see docs/agents/integration-phase-5.md), and switch
 * on `process.env.PAYMENTS_PROVIDER` inside `getProvider()`.
 */

export type PaymentMethodKind = "ach" | "card";

export type CreatePaymentMethodInput = {
  /** The resident's profile id, for the provider's customer record. */
  profileId: string;
  kind: PaymentMethodKind;
  /** A human label like "Checking ••1234". */
  label?: string;
};

export type CreatePaymentMethodResult = {
  /** Opaque token stored as payment_methods.provider_ref. */
  providerRef: string;
};

export type ChargeInput = {
  /** Amount in integer cents. Always read from the DB, never the client. */
  amountCents: number;
  /** The provider_ref of the payment method to debit. */
  methodRef: string | null;
  /** Free-form context, e.g. "Rent — 2026-07". */
  description?: string;
};

export type ChargeResult = {
  /** Opaque processor id stored as payments.provider_ref. */
  providerRef: string;
  status: "succeeded" | "failed";
};

export interface PaymentProvider {
  /** Tokenize a new bank account / card and return an opaque ref. */
  createPaymentMethod(
    input: CreatePaymentMethodInput
  ): Promise<CreatePaymentMethodResult>;
  /** Attempt to move money. The mock succeeds synchronously. */
  charge(input: ChargeInput): Promise<ChargeResult>;
}

function fakeRef(prefix: string): string {
  // Deterministic-enough fake token; not security-sensitive (mock only).
  const rand = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export const mockProvider: PaymentProvider = {
  async createPaymentMethod({ kind }) {
    return { providerRef: fakeRef(kind === "card" ? "pm_card" : "pm_ach") };
  },
  async charge({ amountCents }) {
    // Mock always succeeds for a positive amount; fails for non-positive so
    // callers exercise the failure path during development.
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return { providerRef: fakeRef("pay_fail"), status: "failed" };
    }
    return { providerRef: fakeRef("pay"), status: "succeeded" };
  },
};

/**
 * Returns the active payment provider. Mock today; env-switchable later via
 * `PAYMENTS_PROVIDER` (e.g. "stripe" | "plaid"). Unknown / unset → mock.
 */
export function getProvider(): PaymentProvider {
  switch (process.env.PAYMENTS_PROVIDER) {
    // case "stripe": return stripeProvider;
    // case "plaid":  return plaidProvider;
    default:
      return mockProvider;
  }
}
