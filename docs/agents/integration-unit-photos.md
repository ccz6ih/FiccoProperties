# Integration — Admin Unit Photo Manager

## What was built
Staff can upload and manage photos on the admin unit detail page
(`/admin/units/[id]`): **Listing** photos (public bucket `unit-photos`) and
**Move-in / condition** photos (private bucket `unit-condition`). Thumbnails,
per-photo delete, and an optional caption per upload.

### Files created
- `src/app/(admin)/admin/units/[id]/photos-actions.ts` — `"use server"`:
  - `uploadUnitPhotos(prev, formData)` — staff-only; reads `unit_id`, `kind`,
    `caption`, and `formData.getAll("photos")`. Uploads each image to
    `bucketForKind(kind)` at `${unit_id}/${uuid}.${ext}` via the service-role
    client, then inserts a `unit_photos` row. Revalidates the unit page.
    Returns `PhotoState { ok, error?, uploaded? }`.
  - `deleteUnitPhoto(formData)` — staff-only; looks up row → deletes storage
    object → deletes row → revalidates.
- `src/components/unit-photos-manager.tsx` — `"use client"` `UnitPhotosManager`;
  two sections, thumbnail grid (plain `<img>`), delete forms, upload form with
  `useActionState` + pending state.

### Files edited
- `src/app/(admin)/admin/units/[id]/page.tsx` — ADDED a "Photos" section
  (loads `unit_photos`, resolves listing public URLs + condition signed URLs
  server-side, renders `<UnitPhotosManager>`). Existing make-ready /
  maintenance / turn history content left intact.

## Notes for the integrator
- **No nav links needed** — the feature lives inside the existing unit detail
  page.
- **No new StatusPill statuses, env vars, or dependencies.**
- `unit_photos` is already present in the generated `@/types/database`, so the
  typed `createAdminClient()` is used directly (no loose-cast handle). If types
  are regenerated, nothing here should need to change.
- Uses the **service-role client** (`createAdminClient`) for all storage writes
  and the condition-bucket signed URLs, since the anon key has no storage-write
  access. All actions gate on `requireProfile` + `isStaff` before any
  privileged operation.
- `next.config` already allows 8mb server-action bodies (assumed per spec — not
  modified).
- Condition photos use 1-hour signed URLs (`createSignedUrl(path, 3600)`),
  minted per page render.

## Assumptions
- `bucketForKind`, `listingPublicUrl`, `LISTING_BUCKET`, `CONDITION_BUCKET`
  from `@/lib/unit-photos` and the two storage buckets already exist.
- Photos are ordered by `sort` then `created_at`.
