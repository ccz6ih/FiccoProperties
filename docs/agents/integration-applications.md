# Integration — Applications expansion + admin detail view

Cross-cutting work for the integrator. Nothing here was edited in a
shared/do-not-touch file.

## Migration / types

- No migration in this lane. The new `applications` columns
  (`date_of_birth`, `current_address`, `current_residency_length`,
  `reason_for_moving`, `employer_name`, `employer_phone`, `landlord_name`,
  `landlord_phone`, `landlord_email`, `authorize_screening`,
  `authorize_landlord_contact`, `signature_name`, `pets_ack`, `id_photo_path`,
  `screening_status`) are already migrated and present in
  `src/types/database.ts`. My code uses the typed client directly — no
  `as unknown as SupabaseClient` handles needed.
- Requires the private Storage bucket `application-docs` to exist, and
  `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` env (already used by
  `createAdminClient()`).

## Nav links

- No new nav entry. The detail page lives at `/admin/applications/[id]` and is
  reached by clicking an applicant name on the existing Applications list. The
  existing `Applications` nav link still covers it.

## New `StatusPill` statuses/tones (extend `statusTones` in `dashboard-ui.tsx`)

The detail page passes `screening_status` values to `StatusPill`. Unknown
values render neutral (acceptable), but for correct tones add:

| value         | suggested class                           |
| ------------- | ----------------------------------------- |
| `not_started` | `bg-sand text-ink-soft`                   |
| `invited`     | `bg-[#f6edd6] text-[#8a6a1f]`             |
| `in_progress` | `bg-[#f6edd6] text-[#8a6a1f]` (exists)    |
| `passed`      | `bg-pine-soft text-pine-dark`             |
| `failed`      | `bg-terracotta-soft text-terracotta-dark` (exists) |
| `waived`      | `bg-sand text-ink-faint`                  |

`approved`/`pending` already exist and are reused on the authorizations card to
show consent checkmarks.

## RLS note

`createAdminClient()` (service role) is only used server-side for the optional
ID-photo upload (insert) and for minting a 60-second signed URL on the admin
detail page. The admin layout already enforces `isStaff()`, and
`setScreeningStatus` re-checks `requireProfile` + `isStaff` before updating.
Confirm `application-docs` bucket is private and that the public/anon role has
no policy granting storage access to it.

## New dependencies

None.

## Files added / changed (all within this lane)

- `src/components/apply-form.tsx` (replaced)
- `src/app/(public)/apply/actions.ts` (replaced)
- `src/app/(public)/apply/page.tsx` (intro copy edit)
- `src/app/(admin)/admin/applications/page.tsx` (name now links to detail)
- `src/app/(admin)/admin/applications/[id]/page.tsx` (new)
- `src/app/(admin)/admin/applications/[id]/actions.ts` (new)
- `src/components/screening-status-control.tsx` (new)
