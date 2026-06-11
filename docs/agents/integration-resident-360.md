# Integration — Resident 360 view & resident↔unit linkage

## Migration

None. This phase reads existing tables only (`profiles`, `unit_occupancy`,
`units`, `properties`, `maintenance_requests`, `conversations`, `charges`,
`ledger_entries`, `leases`). The `unit_occupancy` table is already migrated and
in generated types, so no schema changes or type regeneration are required.

## Nav links to add

None required. Each resident row on `/admin/residents` now links to the new
`/admin/residents/<id>` detail page. No layout/nav edits were made (out of lane).

## New `StatusPill` statuses/tones

None. The page renders `profiles.role` (`owner`/`admin`/`resident`), charge
status, maintenance status, and lease status through `StatusPill`. Roles
`owner`/`admin`/`resident` are not in `statusTones` and fall back to the neutral
tone — acceptable. If you want them styled, add to `statusTones` in
`src/components/dashboard-ui.tsx`:

```ts
owner: "bg-pine-soft text-pine-dark",
admin: "bg-[#f6edd6] text-[#8a6a1f]",
resident: "bg-sand text-ink-soft",
```

## Env vars / dependencies

None.

## Order-sensitive / behavior notes

- **Resident↔unit link is `unit_occupancy.occupant_profile_id = auth.uid()`**
  (1:1 per `unit_id`). The portal home and the maintenance create action now
  resolve the resident's unit PRIMARILY via `unit_occupancy`, FALLING BACK to
  the active `leases` row (prior behavior) when no occupancy row exists.
- **Balance** on the 360 page = `sum(ledger_entries.amount_cents)` for the
  resident (positive = owed). **Open charges** = `charges` for the resident with
  status not in (`paid`, `void`).
- **Tenure** is computed in JS from `lease_start_date` → today
  (years/months, e.g. "1 yr 3 mo"). On the portal it falls back to
  `leases.start_date` when there is no occupancy row.
- RLS: the 360 page is staff-only (it reads every resident's rows); it lives
  under `(admin)/admin` and relies on staff full-access policies. The resident
  portal reads only the resident's own `unit_occupancy` row (allowed by the
  `occupant_profile_id = auth.uid()` read policy).
- `unit_occupancy` is in generated types, so the typed client is used
  throughout; multi-table reads use local types + `.returns<T[]>()` /
  `.maybeSingle<T>()`.

## Files created (my lane)

Created:
- `src/app/(admin)/admin/residents/[id]/page.tsx`

Changed:
- `src/app/(admin)/admin/residents/page.tsx` (resident name now links to detail)
- `src/app/(resident)/portal/page.tsx` ("My home" resolves via `unit_occupancy`,
  falls back to active lease; shows tenure)
- `src/app/(resident)/portal/maintenance/actions.ts` (`createMaintenanceRequest`
  resolves `unit_id` via `unit_occupancy` first, then active lease)

No shared/do-not-touch files were edited.
