# Online payments (Stripe ACH) — setup

Online rent payments are **wired but dormant**. `getProvider()` returns a mock
until `PAYMENTS_PROVIDER=stripe`, so nothing moves real money until you switch it
on. Residents keep using the current flow (and you keep recording cash/checks/
money orders manually) the whole time.

Live status + checklist: **Admin → Payments → Online payments** (`/admin/payment-setup`).

## Architecture (already built)
- `src/lib/payments/provider.ts` — provider interface + `getProvider()` switch.
- `src/lib/payments/stripe.ts` — the Stripe ACH provider (PaymentIntents, customer, SetupIntent helper).
- `src/app/(resident)/portal/payments/actions.ts` — `payCharge` handles `succeeded` / `processing` (ACH clearing) / `failed`.
- `src/app/api/webhooks/stripe/route.ts` — settles ACH payments when they clear.

An online payment writes to the **same** `charges` / `payments` / `ledger_entries`
tables as manual entries, so it appears on the rent board, payments log,
delinquency, owner report, and the owner email automatically.

## Environment variables (Vercel → Settings → Environment Variables)
| Var | Value |
| --- | --- |
| `PAYMENTS_PROVIDER` | `stripe` (leave unset/`mock` to stay off) |
| `STRIPE_SECRET_KEY` | `sk_test_…` while testing, `sk_live_…` to go live |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook endpoint |
| `NEXT_PUBLIC_APP_URL` | e.g. `https://38thaveproperties.com` |

## Steps to go live
1. Create the Stripe account; finish business verification (EIN, payout bank).
2. Enable **ACH Direct Debit** + **Financial Connections** in Stripe.
3. Add the **test** keys in Vercel; set `PAYMENTS_PROVIDER=stripe`; redeploy.
4. Finish the resident **bank-link screen** (SetupIntent + Financial Connections
   in the portal add-method UI) — the one remaining client-side piece — and run
   a full test payment in Stripe **test mode**.
5. Add the webhook endpoint `${NEXT_PUBLIC_APP_URL}/api/webhooks/stripe` for
   `payment_intent.succeeded` and `payment_intent.payment_failed`; copy its
   signing secret to `STRIPE_WEBHOOK_SECRET`. Confirm a test payment settles.
6. Swap test keys for **live** keys; pilot with a few tenants.

## Notes
- ACH fees are ~0.8% capped at $5 per debit (verify current Stripe pricing).
- ACH is asynchronous: a payment shows **processing** for 1–3 business days, then
  the webhook marks it paid (or failed → the charge reopens for follow-up).
- Manual entry always stays available; online pay is an added option.
