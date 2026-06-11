# Phase 3 — Maintenance workflow + make-ready checklists

**Read `docs/agents/CONVENTIONS.md` first and obey it.** You are the Maintenance
agent. Residents can already submit requests (`maintenance_requests` exists).
Build the staff-side workflow + make-ready (unit turnover) checklists.

## Goal / user stories

- As **staff**, on a maintenance request I change status, set priority, assign
  it to a staff member, and post internal comments. The board reflects changes.
- As **staff**, when a unit goes vacant I start a **make-ready** from a template
  (a checklist of turnover tasks), check items off, and track the unit to
  ready-to-lease.
- As a **resident**, I keep my existing submit flow, and can add a comment/photo
  note to my own open request.

## Migration — `supabase/migrations/0004_makeready.sql`

- `public.maintenance_comments`: `id`, `request_id uuid references
  public.maintenance_requests(id) on delete cascade`, `author_id uuid references
  public.profiles(id)`, `body text not null`, `internal boolean not null default
  false` (internal = staff-only), `created_at`. RLS: staff full; resident may
  read non-internal comments on their own request and insert comments on their
  own request (never internal).
- `public.makeready_templates`: `id`, `name text`, `created_at`. Seed two rows
  in the migration: "Standard turn" and "Senior unit turn".
- `public.makeready_template_items`: `id`, `template_id` (fk cascade),
  `label text`, `sort int default 0`.
- `public.makeready_turns`: `id`, `unit_id uuid references public.units(id)`,
  `status text check (status in ('open','in_progress','blocked','complete'))
  default 'open'`, `template_id uuid references public.makeready_templates(id)`,
  `started_by uuid references public.profiles(id)`, `created_at`, `updated_at`
  (+ trigger), `completed_at timestamptz`.
- `public.makeready_tasks`: `id`, `turn_id` (fk cascade), `label text`,
  `done boolean not null default false`, `done_by uuid references
  public.profiles(id)`, `done_at timestamptz`, `sort int default 0`.
- RLS: all make-ready tables are **staff-only** (`is_staff()` for select + all
  writes). Index every fk.

## Files you own

- `supabase/migrations/0004_makeready.sql`
- `src/app/(admin)/admin/maintenance/page.tsx` (replace board — make cards link
  to detail, keep the column board)
- `src/app/(admin)/admin/maintenance/[id]/page.tsx` (detail: status/priority/
  assignee controls, comment thread)
- `src/app/(admin)/admin/maintenance/actions.ts`
- `src/app/(admin)/admin/turns/page.tsx` (make-ready board across units)
- `src/app/(admin)/admin/turns/[id]/page.tsx` (one turn: checklist with toggles)
- `src/app/(admin)/admin/turns/actions.ts` (start turn from template, toggle
  task, complete)
- `src/app/(admin)/admin/units/[id]/page.tsx` (per-unit history: requests +
  turns; "Start make-ready" button)
- `src/app/(resident)/portal/maintenance/page.tsx` (enhance: show comments on
  own requests, allow a reply) — you are sole owner; `maintenance-form.tsx`
  stays as-is unless you extend it (you may, you own it for this phase).
- `src/components/maintenance-*.tsx`, `src/components/makeready-*.tsx`
- `docs/agents/integration-phase-3.md`

## Shared — do not touch
Per CONVENTIONS.md. You need TWO new admin nav links: **Turns** (`/admin/turns`)
and the existing **Maintenance** stays. Put the nav request in your integration
file. Do NOT edit the admin layout yourself.

## UX requirements

- Maintenance detail: status + priority as selects that submit on change (mirror
  the existing `application-status-control.tsx` pattern), an assignee select
  (staff profiles), and a comment thread (internal toggle for staff).
- Turn checklist: large tappable rows with a checkbox, progress bar
  (`x/y done`), and a Complete button enabled when all done.
- Reuse `StatusPill`, `Card`, `PageHeader`, `EmptyState`. New statuses
  (`blocked`, `complete`) → list them in integration file for `statusTones`.

## Acceptance

- `npx tsc --noEmit` clean for your files.
- Staff can move a request across the board, comment, assign; start a make-ready
  from a template, check items, and complete it.
- RLS keeps make-ready + internal comments staff-only; residents only see their
  own non-internal comments.
