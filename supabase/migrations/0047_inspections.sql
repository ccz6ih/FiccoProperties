-- =============================================================================
-- Ficco Properties — 0047 unit inspections
-- Scheduled walk-throughs (annual / seasonal / follow-up) with an entry-notice
-- email to the resident, a room-by-room checklist with photos, escalation of
-- findings into tasks, and a permanent per-unit history. Photos reuse the
-- private unit-condition bucket.
-- =============================================================================

create table if not exists public.inspections (
  id             uuid primary key default gen_random_uuid(),
  unit_id        uuid not null references public.units (id) on delete cascade,
  kind           text not null default 'annual'
                 check (kind in ('annual','seasonal','move_in','move_out','follow_up','complaint')),
  scheduled_for  date not null,
  time_window    text,                       -- "9:00 am – 12:00 pm"
  status         text not null default 'scheduled'
                 check (status in ('scheduled','notice_sent','completed','canceled')),
  notice_sent_at timestamptz,
  completed_at   timestamptz,
  summary        text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists inspections_unit_idx on public.inspections (unit_id);
create index if not exists inspections_date_idx on public.inspections (scheduled_for);
create index if not exists inspections_status_idx on public.inspections (status);

create table if not exists public.inspection_items (
  id             uuid primary key default gen_random_uuid(),
  inspection_id  uuid not null references public.inspections (id) on delete cascade,
  area           text not null default 'other',
  condition      text not null default 'good'
                 check (condition in ('good','fair','needs_attention','urgent')),
  note           text,
  photo_path     text,
  task_id        uuid references public.tasks (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists inspection_items_inspection_idx on public.inspection_items (inspection_id);

alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;

create policy "inspections: staff all"
  on public.inspections for all
  using (public.is_staff()) with check (public.is_staff());

create policy "inspection_items: staff all"
  on public.inspection_items for all
  using (public.is_staff()) with check (public.is_staff());
