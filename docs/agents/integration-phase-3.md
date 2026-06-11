# Integration — Phase 3 (Maintenance workflow + make-ready)

## Migration

- `supabase/migrations/0004_makeready.sql` — apply after `0001` (and after any
  earlier-numbered phase migrations). Creates `maintenance_comments`,
  `makeready_templates`, `makeready_template_items`, `makeready_turns`,
  `makeready_tasks`; seeds two templates ("Standard turn", "Senior unit turn")
  with their items; enables RLS on all five tables.
- After applying, **regenerate `src/types/database.ts`**. My pages/actions read
  and write the new tables through a loosely-typed handle
  (`supabase as unknown as SupabaseClient`) per CONVENTIONS, so they compile
  before regeneration. Once types exist you can drop those casts if desired (not
  required).

## Nav links to add (admin layout — `src/app/(admin)/admin/layout.tsx`)

Add a **Turns** link. **Maintenance** already exists and stays. Suggested:

```ts
{ href: "/admin/turns", label: "Turns", icon: navIcons.building },
```

Place it right after the Maintenance entry. (`navIcons.building` already exists
in `src/components/icons.tsx`.)

There is also a new per-unit detail route at `/admin/units/[id]`. There is no
units list page yet, but unit cards link to it from the turn detail and from
maintenance history. If a units index gets added later, link rows to
`/admin/units/{id}`.

## New `StatusPill` statuses/tones (`src/components/dashboard-ui.tsx`)

`statusTones` already covers `open`, `in_progress`, `on_hold`, `completed`,
`cancelled`, plus the priorities. Add these new values so they render with the
right tone:

```ts
blocked: "bg-terracotta-soft text-terracotta-dark",
complete: "bg-pine-soft text-pine-dark",
internal: "bg-[#f6edd6] text-[#8a6a1f]",
```

- `blocked` / `complete` are the new make-ready turn statuses.
- `internal` is the badge shown on staff-only maintenance comments.

Unknown values fall back to a neutral tone today, so the UI is correct either
way — adding these just gives them distinct colors.

## Env vars / dependencies

None. No new env vars, no new npm dependencies.

## Order-sensitive notes for the integrator

- The make-ready flow depends on the seeded templates existing — they are seeded
  inside `0004` (idempotent, guarded by `not exists`).
- "Start make-ready" (`startTurn`) copies the chosen template's items into
  per-turn `makeready_tasks` and flips the unit `status` to `make_ready`.
  `completeTurn` only succeeds when every task is done and flips the unit back to
  `available`. Both write to the existing `units` table (already in types).
- `maintenance_requests.completed_at` is set/cleared by `setMaintenanceStatus`
  when status moves to/from `completed`.

## RLS summary (security boundary)

- `maintenance_comments`: staff full access; residents may **read** non-internal
  comments on their **own** request and **insert** non-internal comments on
  their own request (insert policy forces `internal = false` and request
  ownership). Residents can never see internal notes.
- All `makeready_*` tables are **staff-only** (`is_staff()` for select + all
  writes).

## Files created/changed (my lane)

Created:
- `supabase/migrations/0004_makeready.sql`
- `src/app/(admin)/admin/maintenance/[id]/page.tsx`
- `src/app/(admin)/admin/maintenance/actions.ts`
- `src/app/(admin)/admin/turns/page.tsx`
- `src/app/(admin)/admin/turns/[id]/page.tsx`
- `src/app/(admin)/admin/turns/actions.ts`
- `src/app/(admin)/admin/units/[id]/page.tsx`
- `src/components/maintenance-controls.tsx`
- `src/components/maintenance-comment-form.tsx`
- `src/components/makeready-checklist.tsx`
- `src/components/makeready-turn-status.tsx`
- `src/components/makeready-start-form.tsx`

Changed:
- `src/app/(admin)/admin/maintenance/page.tsx` — board cards now link to detail.
- `src/app/(resident)/portal/maintenance/page.tsx` — shows non-internal comments
  and a reply box on open requests.
- `src/app/(resident)/portal/maintenance/actions.ts` — added `addResidentComment`
  server action (resident reply on own request).
