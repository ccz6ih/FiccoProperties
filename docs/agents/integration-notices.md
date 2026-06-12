# Integration — Notices / postings

## Nav links to add

- **Admin layout** (staff sidebar): label `Notices` → `/admin/notices`.
- **Resident layout** (portal nav): label `Notices` → `/portal/notices`.

## StatusPill statuses / tones

The `notices.status` enum adds four values not yet in `statusTones` in
`src/components/dashboard-ui.tsx`. They currently fall back to the neutral
`bg-sand text-ink-soft` tone, which renders acceptably. Suggested exact tones:

```ts
served:    "bg-pine-soft text-pine-dark",      // active/delivered
cured:     "bg-pine-soft text-pine-dark",      // resolved favorably
expired:   "bg-terracotta-soft text-terracotta-dark",
withdrawn: "bg-sand text-ink-soft",            // already fine as neutral
// "draft" already exists (neutral) and is reused.
```

(Type labels in lists/detail come from `NOTICE_LABELS`, not StatusPill.)

## Notes / assumptions

- Reads use the typed `createClient`; inserts/updates use a loose
  `SupabaseClient` handle (per CONVENTIONS) because `database.ts` doesn't yet
  know the `notices` table. Tighten after regenerating types.
- Resident options in `/admin/notices/new` come from `profiles` with role
  `resident` or `applicant`, joined to `unit_occupancy → units → properties`
  for the home label + address. Residents with no occupancy still appear; their
  notice is saved with `unit_id = null` and uses placeholder address text.
- `createNotice` resolves `unit_id` from the resident's `unit_occupancy` row at
  save time.
- Money: amount input is dollars → stored as integer `amount_cents`.
- `pay_or_quit` defaults `cure_by` to ~10 days out, computed client-side.
- Portal page relies on RLS to return only the resident's non-draft notices
  (it also filters `resident_id = user.id` defensively).
- No shared/do-not-touch files were edited. No new dependencies. No migration
  in this lane (the `notices` table was already migrated per the spec).

## Files created

- `src/app/(admin)/admin/notices/page.tsx`
- `src/app/(admin)/admin/notices/new/page.tsx`
- `src/app/(admin)/admin/notices/[id]/page.tsx`
- `src/app/(admin)/admin/notices/actions.ts`
- `src/components/notice-create-form.tsx`
- `src/components/notice-status-control.tsx`
- `src/app/(resident)/portal/notices/page.tsx`
