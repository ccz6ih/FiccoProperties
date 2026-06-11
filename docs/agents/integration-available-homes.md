# Integration — Public "Available homes" gallery

## Migration

None. Reads existing tables only (`units`, `unit_photos`). `unit_photos` is
already migrated and in generated types. No schema changes, no type
regeneration required.

## Nav links to add

None. The section is added inline to the existing public property page
(`/properties/<slug>`); it already links from the home page communities grid.

## New `StatusPill` statuses/tones

None. Unit status is rendered via a plain `<Badge>` (pine for `available`,
terracotta for `make_ready`), not `StatusPill`.

## Env vars / dependencies

None. Image URLs use the existing public `unit-photos` bucket via
`listingPublicUrl(path)`.

## Order-sensitive / RLS notes

- The query selects `unit_photos` with `kind='listing'` only. RLS already makes
  `kind='listing'` rows world-readable, so the anon server client
  (`createClient` from `@/lib/supabase/server`) can read them on the public page.
- `.eq("unit_photos.kind", "listing")` filters the embedded rows but does NOT
  drop units that have zero listing photos, so the page-side
  `.filter(unit => unit.photos.length > 0)` is required and intentional.
- Photos are sorted in JS by `sort` then `created_at` (the embedded-resource
  order isn't guaranteed by the `.order("label")` on the parent).
- `export const revalidate = 60` is preserved.

## Files created / changed (my lane)

Created:
- `src/components/unit-gallery.tsx` ("use client" — main image + thumbnail swap)
- `docs/agents/integration-available-homes.md`

Changed:
- `src/app/(public)/properties/[slug]/page.tsx` — added `getAvailableHomes()`
  loader, the "Available homes" section, and a `UnitSpec` helper. Existing
  hero / highlights / CTA / back-link untouched.

No shared/do-not-touch files were edited.
