# Phase 2 — Leases + e-signature

**Read `docs/agents/CONVENTIONS.md` first and obey it.** You are the Leases
agent. Build lease lifecycle management: staff create a lease (often from an
approved application), the resident reviews and e-signs it, and it becomes
active.

## Goal / user stories

- As **staff**, from an approved application or a vacant unit, I create a lease
  (unit, resident, term, rent, deposit) and send it for signature.
- As a **resident**, I see my lease, read the terms, and sign it online
  (typed-name signature + checkbox consent, timestamp + IP recorded). Signing
  flips the lease to `active`.
- As **staff**, I see a lease detail page with status, signature record, and can
  end/terminate a lease.

## Migration — `supabase/migrations/0003_leases.sql`

The `leases` table already exists (see `0001`). Extend it and add signing:

- `alter table public.leases` add: `application_id uuid references
  public.applications(id) on delete set null`, `terms text`,
  `signature_name text`, `signature_ip text`. (Status enum already includes
  `draft`, `pending_signature`, `active`, `ended`, `terminated`.)
- New table `public.lease_events` (audit trail): `id`, `lease_id` (fk, cascade),
  `actor_id uuid references public.profiles(id)`, `type text check (type in
  ('created','sent','signed','activated','ended','terminated','note'))`,
  `note text`, `created_at`.
- RLS: residents can `select` their own lease events (lease.resident_id =
  auth.uid()) and the resident may `insert` a `signed` event for their own
  lease; staff (`is_staff()`) full access. Residents may `update` their own
  lease ONLY to set signature fields + status `pending_signature`→`active`
  (enforce via a policy `with check` that resident_id = auth.uid()). Staff can
  do all writes. Index `lease_events(lease_id)`.

## Files you own

- `supabase/migrations/0003_leases.sql`
- `src/app/(admin)/admin/leases/page.tsx` (replace existing list — add "New
  lease" action + link rows to detail)
- `src/app/(admin)/admin/leases/new/page.tsx` (create form: pick unit +
  resident, term, rent/deposit, terms text; prefill from `?application=<id>`)
- `src/app/(admin)/admin/leases/[id]/page.tsx` (detail: status, terms,
  signature record, event timeline, end/terminate buttons)
- `src/app/(admin)/admin/leases/actions.ts` (create, send-for-signature, end,
  terminate)
- `src/app/(resident)/portal/lease/page.tsx` (replace existing — if status is
  `pending_signature`, show the signing UI; else show current lease)
- `src/app/(resident)/portal/lease/actions.ts` (sign action)
- `src/components/lease-*.tsx` (e.g. `lease-sign-form.tsx`,
  `lease-create-form.tsx`, `lease-timeline.tsx`)
- `docs/agents/integration-phase-2.md`

## Shared — do not touch
See CONVENTIONS.md golden rule #1 + the list there (layouts, dashboard-ui,
ui.tsx, database.ts, format.ts, auth.ts, supabase/*, middleware, 0001/0002).
The admin "Leases" nav link already exists; if you add `/admin/leases/new` etc.
they are sub-routes, no nav change needed. Note any nav want in your integration file.

## UX requirements

- Signing flow: show full terms in a scrollable card, a "Type your full legal
  name" input, a consent checkbox ("I agree this is my electronic signature"),
  and a Sign button (disabled until both filled). On success show a confirmed
  state with the signed date.
- Use `StatusPill` for lease status, `formatCents`/`formatDate`, `Card`,
  `PageHeader`. Capture IP in the server action from request headers
  (`x-forwarded-for`).
- Empty/edge states handled (no leases, already signed, terminated).

## Acceptance

- `npx tsc --noEmit` clean for your files.
- A staff user can create a lease and send it; a resident can sign it; status
  becomes `active`; an event timeline reflects each step.
- RLS prevents a resident from reading/altering another resident's lease.
