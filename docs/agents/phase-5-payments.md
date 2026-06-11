# Phase 5 — Rent payments (ACH-first)

**Read `docs/agents/CONVENTIONS.md` first and obey it.** You are the Payments
agent. Build the rent payment system: charges/invoices generated from a lease,
residents pay (ACH-first), staff reconcile. Build against a **pluggable payment
provider interface with a mock provider** — do NOT integrate real Stripe/Plaid
keys (note required env vars in your integration file for later).

The `leases` table already exists (`0001`) with `rent_cents`. Reference
`leases(id)` — do not depend on the Phase 2 migration.

## Goal / user stories

- As **staff**, I generate a monthly rent **charge** for a lease (or all active
  leases), see who's paid/unpaid, and record a manual/offline payment.
- As a **resident**, I see my balance and charges, add a bank account (ACH,
  mock), and pay a charge. The payment records to a ledger and marks the charge
  paid.
- A simple **ledger** is the source of truth (debits = charges, credits =
  payments); balance = sum.

## Migration — `supabase/migrations/0006_payments.sql`

- `public.payment_methods`: `id`, `profile_id uuid references
  public.profiles(id) on delete cascade`, `kind text check (kind in
  ('ach','card')) default 'ach'`, `label text` (e.g. "Checking ••1234"),
  `provider_ref text`, `is_default boolean default false`, `created_at`.
  RLS: owner reads/writes own (`profile_id = auth.uid()`); staff read all.
- `public.charges`: `id`, `lease_id uuid references public.leases(id) on delete
  cascade`, `resident_id uuid references public.profiles(id)`,
  `amount_cents int not null`, `description text`, `due_date date`,
  `status text check (status in ('open','paid','void','past_due')) default
  'open'`, `period text` (e.g. '2026-07'), `created_at`, `updated_at` (+trigger).
  RLS: resident reads own (`resident_id = auth.uid()`); staff full.
- `public.payments`: `id`, `charge_id uuid references public.charges(id) on
  delete set null`, `resident_id uuid references public.profiles(id)`,
  `amount_cents int not null`, `method_id uuid references
  public.payment_methods(id)`, `provider_ref text`, `status text check (status
  in ('pending','succeeded','failed','refunded')) default 'pending'`,
  `created_at`. RLS: resident reads own + may insert a payment for a charge they
  own (`resident_id = auth.uid()`); staff full.
- `public.ledger_entries` (append-only): `id`, `resident_id uuid references
  public.profiles(id)`, `lease_id uuid references public.leases(id)`,
  `kind text check (kind in ('charge','payment','adjustment'))`,
  `amount_cents int not null` (positive = owed, negative = paid), `ref_id uuid`,
  `memo text`, `created_at`. RLS: resident reads own; staff full + insert.
- Index every fk + `charges(resident_id, status)`.

## Files you own

- `supabase/migrations/0006_payments.sql`
- `src/lib/payments/provider.ts` — a `PaymentProvider` interface
  (`createPaymentMethod`, `charge`) + a `mockProvider` implementing it
  (returns a fake `provider_ref`, succeeds synchronously). A `getProvider()`
  that returns the mock now (env-switchable later).
- `src/app/(resident)/portal/payments/page.tsx` (balance, open charges, pay
  button, payment methods, history)
- `src/app/(resident)/portal/payments/actions.ts` (add method, pay charge —
  writes payment + ledger + marks charge paid, all server-side)
- `src/app/(admin)/admin/payments/page.tsx` (charges overview, who's unpaid,
  "Generate this month's rent" action, record offline payment)
- `src/app/(admin)/admin/payments/actions.ts`
- `src/components/payments-*.tsx`
- `docs/agents/integration-phase-5.md`

## Shared — do not touch
Per CONVENTIONS.md. You need new nav links: resident **Payments**
(`/portal/payments`) and admin **Payments** (`/admin/payments`). Put them in your
integration file. Do NOT edit layouts.

## UX requirements

- Resident payments page: a big balance card (`StatCard`-style, `formatCents`),
  a list of open charges each with a Pay button, a payment-methods section with
  an "Add bank account (ACH)" mock form, and a payment history table.
- Pay action must be atomic server-side: call provider → on success insert
  `payments` (succeeded) + `ledger_entries` (negative) + set charge `paid`.
  Never trust client-sent amounts; read the charge amount from the DB.
- Admin: generate charges for all active leases for a given month (idempotent —
  skip leases that already have a charge for that `period`), and a table of
  charges with status + a "Record payment" offline action.
- Reuse `Card`, `StatCard`, `PageHeader`, `EmptyState`, `StatusPill`,
  `formatCents`, `formatDate`.

## Acceptance

- `npx tsc --noEmit` clean for your files.
- Staff generate a month of rent charges; a resident pays one via the mock
  provider; balance and ledger update; charge shows `paid`.
- RLS prevents a resident from seeing another resident's charges/payments.
- Integration file lists the real-provider env vars (e.g. `STRIPE_SECRET_KEY`,
  `PLAID_*`) needed to swap the mock later.
