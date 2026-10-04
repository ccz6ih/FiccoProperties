-- =============================================================================
-- 38th Ave Properties — 0058 recurring work
--
-- Seasonal jobs — gutters, furnace filters, sprinkler blow-out — exist nowhere
-- in the system, so they live in somebody's head and get remembered late. This
-- is the schedule they're raised from: a cron reads it each morning and creates
-- the real task (or maintenance request) when its lead time comes round.
--
-- Safe to run more than once: every statement is guarded.
-- =============================================================================

create table if not exists public.recurring_work (
  id            uuid primary key default gen_random_uuid(),

  title         text not null,
  details       text,

  -- What to raise when it comes due. A resident-facing repair is possible but
  -- these are nearly always office work.
  kind          text not null default 'task'
                check (kind in ('task', 'maintenance')),
  category      text not null default 'other',
  priority      text not null default 'normal'
                check (priority in ('low', 'normal', 'high', 'urgent', 'emergency')),

  -- Where. A whole community (gutters at The Villa) or one home (a filter).
  property_id   uuid references public.properties (id) on delete cascade,
  unit_id       uuid references public.units (id) on delete cascade,
  assignee_id   uuid references public.profiles (id) on delete set null,

  -- When. The months it runs in (1-12) covers every real case: monthly is all
  -- twelve, quarterly is four, blow-out is one. Simpler and more honest than a
  -- frequency enum that can't say "April and October".
  months        smallint[] not null default '{}',
  day_of_month  smallint not null default 1
                check (day_of_month between 1 and 28),
  -- Raise it this far ahead so there's time to actually do it.
  lead_days     smallint not null default 7
                check (lead_days between 0 and 90),

  active        boolean not null default true,
  -- Guards against raising the same occurrence twice.
  last_raised_on date,

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists recurring_work_active_idx on public.recurring_work (active);
create index if not exists recurring_work_unit_idx on public.recurring_work (unit_id);
create index if not exists recurring_work_property_idx on public.recurring_work (property_id);

alter table public.recurring_work enable row level security;

-- Staff-only, like tasks: this is the office's own schedule.
drop policy if exists "recurring_work: staff all" on public.recurring_work;
create policy "recurring_work: staff all"
  on public.recurring_work for all
  using (public.is_staff()) with check (public.is_staff());

-- Lets a raised job point back at the schedule that raised it, so the same
-- occurrence is never created twice and the task can say where it came from.
alter table public.tasks
  add column if not exists recurring_id uuid references public.recurring_work (id) on delete set null;

create index if not exists tasks_recurring_idx on public.tasks (recurring_id);
