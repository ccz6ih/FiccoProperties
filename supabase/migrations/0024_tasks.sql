-- =============================================================================
-- Ficco Properties — 0024 staff tasks (the "schedule" / work board)
-- General staff work items (fences, cleaning, trash, emergencies, extras…),
-- assigned to a staffer and optionally linked to a property/unit. Distinct from
-- resident-submitted maintenance_requests. Staff-only.
-- =============================================================================
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  details      text,
  category     text not null default 'other'
               check (category in ('repair','cleaning','trash','fence','landscaping',
                                    'emergency','inspection','admin','extra','other')),
  status       text not null default 'todo'
               check (status in ('todo','in_progress','done','cancelled')),
  priority     text not null default 'normal'
               check (priority in ('low','normal','high','urgent')),
  assignee_id  uuid references public.profiles (id) on delete set null,
  property_id  uuid references public.properties (id) on delete set null,
  unit_id      uuid references public.units (id) on delete set null,
  due_date     date,
  completed_at timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_unit_idx on public.tasks (unit_id);
create index if not exists tasks_due_idx on public.tasks (due_date);

alter table public.tasks enable row level security;

create policy "tasks: staff all"
  on public.tasks for all
  using (public.is_staff())
  with check (public.is_staff());
