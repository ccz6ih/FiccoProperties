# Integration notes — Phase 2 (Leases + e-signature)

## Migration
- `supabase/migrations/0003_leases.sql` — apply after `0001`/`0002`.
  - `alter table public.leases` adds: `application_id` (fk → applications, on delete set null), `terms text`, `signature_name text`, `signature_ip text`.
  - New table `public.lease_events` (audit trail): `id`, `lease_id` (fk cascade), `actor_id` (fk → profiles, on delete set null), `type` (check: created/sent/signed/activated/ended/terminated/note), `note`, `created_at`. Index on `lease_events(lease_id)`.
  - RLS:
    - `lease_events`: residents `select` events for their own lease (join on `leases.resident_id = auth.uid()`); residents may `insert` only a `signed` event for their own lease (`actor_id = auth.uid()`); staff full insert/select.
    - `leases`: added a resident-only `update` policy allowing `pending_signature → active` on their own lease (using `resident_id = auth.uid() and status = 'pending_signature'`, with check `resident_id = auth.uid() and status = 'active'`). Staff retain the unrestricted `leases: staff write` policy from `0001`.

## Regenerate types
After applying `0003`, regenerate `src/types/database.ts`. Then the loose-client casts can be tightened:
- `src/app/(admin)/admin/leases/actions.ts` — uses `supabase as unknown as SupabaseClient` (`loose()`) for `leases` inserts/updates (new columns) and all `lease_events` writes.
- `src/app/(resident)/portal/lease/actions.ts` — uses the same loose cast for the sign update + `lease_events` insert.
- `src/app/(admin)/admin/leases/[id]/page.tsx` — uses a loose cast only to *read* `lease_events`.
The `leases` page reads use `.returns<LocalType[]>()` with hand-written local types, so they need no change.

## StatusPill statuses
No new statuses needed — `draft`, `pending_signature`, `active`, `ended`, `terminated` are already mapped in `dashboard-ui.tsx` `statusTones`. (`ended`/`terminated` fall through to the neutral default tone, which reads fine; if you want distinct tones, add `ended: "bg-sand text-ink-soft"` and `terminated: "bg-terracotta-soft text-terracotta-dark"`.)

## Nav links
- Admin "Leases" nav link already exists → `/admin/leases`. New sub-routes `/admin/leases/new` and `/admin/leases/[id]` are reached from the list page (the "New lease" button + clickable resident rows). **No nav change required.**
- Resident "Lease" nav link already exists → `/portal/lease`. No change.

## Cross-lane integration want (applications page — NOT my lane)
The new-lease form supports prefill via `/admin/leases/new?application=<applicationId>`. It matches the application's `unit_id` and (by email) an existing profile, and prefills rent from the unit. To wire this end-to-end, the **applications** owner could add a "Create lease" link/button on an approved application pointing to `/admin/leases/new?application=${app.id}`. Not required for Phase 2 to function (staff can also start from `/admin/leases` → New lease and pick everything manually).

## New env vars / dependencies
- None. No new npm packages. IP is captured server-side from `x-forwarded-for` (fallback `x-real-ip`) via `next/headers`.

## Order-sensitive notes
- The resident sign flow requires a `leases` row in status `pending_signature` whose `resident_id` matches the logged-in user. Staff create it (draft) then "Send for signature".
- `resident_id` must reference an existing `profiles` row. The new-lease form lists profiles with role `resident` or `applicant`; the integrator/staff are responsible for the resident having an account before lease creation.

## Files created / changed (my lane only)
- `supabase/migrations/0003_leases.sql` (new)
- `src/app/(admin)/admin/leases/page.tsx` (replaced: New lease action + clickable rows)
- `src/app/(admin)/admin/leases/new/page.tsx` (new)
- `src/app/(admin)/admin/leases/[id]/page.tsx` (new)
- `src/app/(admin)/admin/leases/actions.ts` (new: createLease, sendForSignature, endLease, terminateLease)
- `src/app/(resident)/portal/lease/page.tsx` (replaced: signing UI vs current-lease view)
- `src/app/(resident)/portal/lease/actions.ts` (new: signLease)
- `src/components/lease-create-form.tsx` (new)
- `src/components/lease-sign-form.tsx` (new)
- `src/components/lease-timeline.tsx` (new)
