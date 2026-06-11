# Integration — Phase 5 (Rent payments, ACH-first)

Everything below is cross-cutting work the integrator must apply. Nothing here
was edited in a shared/do-not-touch file.

## Migration

- New file: `supabase/migrations/0006_payments.sql`
- Apply after `0001`. Adds `payment_methods`, `charges`, `payments`,
  `ledger_entries` with RLS. Depends only on `profiles` and `leases` (both in
  `0001`). After applying, **regenerate `src/types/database.ts`** — my server
  actions use the loosely-typed `as unknown as SupabaseClient` handle for
  inserts/updates on these new tables; you can tighten those once the types
  exist.

## Nav links to add (do NOT let me touch the layouts — wire these in)

- **Resident** dashboard nav → label `Payments`, href `/portal/payments`.
- **Admin** dashboard nav → label `Payments`, href `/admin/payments`.
- These belong in `src/components/dashboard-nav.tsx` (the shared nav config).

## New `StatusPill` statuses/tones (extend `statusTones` in `dashboard-ui.tsx`)

My pages pass these `status` values to `StatusPill`. Unknown values currently
render neutral, which is acceptable, but for correct tones add:

| value       | suggested class (matches existing palette)     |
| ----------- | ---------------------------------------------- |
| `paid`      | `bg-pine-soft text-pine-dark`                  |
| `past_due`  | `bg-terracotta-soft text-terracotta-dark`      |
| `void`      | `bg-sand text-ink-faint`                        |
| `succeeded` | `bg-pine-soft text-pine-dark`                  |
| `pending`   | `bg-[#f6edd6] text-[#8a6a1f]`                  |
| `failed`    | `bg-terracotta-soft text-terracotta-dark`      |
| `refunded`  | `bg-sand text-ink-soft`                         |

Note: `open` and `active` already exist in `statusTones` and are reused as-is
(`open` = outstanding charge, `active` = default payment method badge).

## Env vars (for swapping the mock provider later)

The provider lives behind `getProvider()` in `src/lib/payments/provider.ts` and
returns the in-memory **mock** today. To switch to a real processor later:

- `PAYMENTS_PROVIDER` — selects the implementation; unset/unknown → mock.
  (e.g. `stripe` or `plaid`.)
- Stripe path (cards + ACH via Stripe): `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, optional `STRIPE_PUBLISHABLE_KEY` (client).
- Plaid path (bank linking for ACH): `PLAID_CLIENT_ID`, `PLAID_SECRET`,
  `PLAID_ENV` (`sandbox` | `production`).

All of these are **server-only**; never reference them from a client component.
No keys are required to run the mock.

## New dependencies

None. (When a real provider is wired, add its SDK, e.g. `stripe` or `plaid`.)

## Order-sensitive notes

- Charges require an **active `leases` row** with `rent_cents > 0`. "Generate
  this month's rent" only bills leases where `status = 'active'`.
- Charge generation is **idempotent** per `(lease_id, period)` — enforced both
  by a partial unique index and by a pre-check in the action. Re-running is safe.
- The **ledger is the source of truth** for the resident balance
  (`sum(amount_cents)`; positive = owed, negative = paid). Both charge creation
  and payment write matching ledger rows, so don't compute balance from
  `charges`/`payments` directly.
- Pay flow is atomic + server-side: amount is read from the DB charge (never the
  client), provider is called, then payment (succeeded) + negative ledger entry +
  charge → `paid` are written.

## Files added (all within the Phase 5 lane)

- `supabase/migrations/0006_payments.sql`
- `src/lib/payments/provider.ts`
- `src/app/(resident)/portal/payments/page.tsx`
- `src/app/(resident)/portal/payments/actions.ts`
- `src/app/(admin)/admin/payments/page.tsx`
- `src/app/(admin)/admin/payments/actions.ts`
- `src/components/payments-add-method.tsx`
- `src/components/payments-pay-button.tsx`
- `src/components/payments-generate-form.tsx`
- `src/components/payments-record-button.tsx`
