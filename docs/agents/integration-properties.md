# Integration — Admin Properties & Units management

## Migration

None. This phase reads/writes existing tables only (`properties`, `units`,
`leases`, `profiles`). No schema changes, no type regeneration required.

## Nav links to add

None to add. The **Properties** link (`/admin/properties`) already exists in the
admin layout. Do not touch the layout.

## New `StatusPill` statuses/tones (`src/components/dashboard-ui.tsx`)

The unit statuses I use are `occupied`, `available`, `make_ready`, `offline`.
I render these via plain `<select>` controls (not `StatusPill`), so no
`statusTones` change is strictly required. If a future page renders unit status
through `StatusPill`, consider adding:

```ts
occupied: "bg-pine-soft text-pine-dark",
available: "bg-[#f6edd6] text-[#8a6a1f]",
make_ready: "bg-sand text-ink-soft",
offline: "bg-sand text-ink-faint",
```

(`make_ready` already exists implicitly via make-ready flow elsewhere; unknown
values fall back to neutral, so the UI is correct either way.)

## Env vars / dependencies

None.

## Follow-up the integrator may want (not in my lane)

- The vacant-unit "Start lease →" link points to `/admin/leases/new` (no unit
  preselected). `src/app/(admin)/admin/leases/new/page.tsx` currently only reads
  `?application=` from `searchParams`. **Suggested enhancement:** have that page
  also accept `?unit=<id>` and preselect the unit in `LeaseCreateForm`. If/when
  that's added, change the link in
  `src/app/(admin)/admin/properties/[slug]/page.tsx` to
  `/admin/leases/new?unit=${u.id}`. I did not edit the leases/new page (out of
  lane).

## Order-sensitive notes

- `setUnitStatus` and `updateUnit` write the existing `units` table (already in
  generated types) — no loose-typed handle needed. Both are guarded by the
  `units` staff-write RLS policy; non-staff updates are rejected by RLS.
- The unit roster reads the **active** lease per unit (`leases.status = 'active'`)
  joined to the resident `profiles`. A unit with no active lease shows "Vacant".
- Unit labels are sorted numerically by trailing number ("Unit 1".."Unit 61");
  labels without a trailing number (e.g. "House") sort last.

## Files created (my lane)

Created:
- `src/app/(admin)/admin/properties/page.tsx`
- `src/app/(admin)/admin/properties/[slug]/page.tsx`
- `src/app/(admin)/admin/properties/actions.ts`
- `src/components/unit-status-control.tsx`
- `src/components/unit-edit-form.tsx`

Changed: none (no shared files touched).
