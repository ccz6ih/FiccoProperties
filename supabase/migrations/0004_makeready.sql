-- =============================================================================
-- Ficco Properties — 0004 maintenance comments + make-ready (unit turnover)
-- Adds the staff-side maintenance workflow (internal comment thread) and the
-- make-ready checklist system: templates, template items, turns, and per-turn
-- tasks. Run AFTER 0001_ficco_properties_schema.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- maintenance_comments  (thread on a maintenance request)
--   internal = true   -> staff-only note
--   internal = false  -> visible to the resident who owns the request
-- ---------------------------------------------------------------------------
create table if not exists public.maintenance_comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.maintenance_requests (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  body        text not null,
  internal    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists maintenance_comments_request_idx on public.maintenance_comments (request_id);
create index if not exists maintenance_comments_author_idx on public.maintenance_comments (author_id);

-- ---------------------------------------------------------------------------
-- makeready_templates  (named checklist blueprints)
-- ---------------------------------------------------------------------------
create table if not exists public.makeready_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- makeready_template_items  (the lines that get copied into a new turn)
-- ---------------------------------------------------------------------------
create table if not exists public.makeready_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.makeready_templates (id) on delete cascade,
  label        text not null,
  sort         int not null default 0
);

create index if not exists makeready_template_items_template_idx
  on public.makeready_template_items (template_id);

-- ---------------------------------------------------------------------------
-- makeready_turns  (one unit turnover in progress)
-- ---------------------------------------------------------------------------
create table if not exists public.makeready_turns (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid references public.units (id) on delete set null,
  status       text not null default 'open'
               check (status in ('open', 'in_progress', 'blocked', 'complete')),
  template_id  uuid references public.makeready_templates (id) on delete set null,
  started_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists makeready_turns_unit_idx on public.makeready_turns (unit_id);
create index if not exists makeready_turns_template_idx on public.makeready_turns (template_id);
create index if not exists makeready_turns_status_idx on public.makeready_turns (status);

create trigger makeready_turns_set_updated_at
  before update on public.makeready_turns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- makeready_tasks  (a checklist line on a turn)
-- ---------------------------------------------------------------------------
create table if not exists public.makeready_tasks (
  id        uuid primary key default gen_random_uuid(),
  turn_id   uuid not null references public.makeready_turns (id) on delete cascade,
  label     text not null,
  done      boolean not null default false,
  done_by   uuid references public.profiles (id) on delete set null,
  done_at   timestamptz,
  sort      int not null default 0
);

create index if not exists makeready_tasks_turn_idx on public.makeready_tasks (turn_id);

-- =============================================================================
-- Seed templates
-- =============================================================================
insert into public.makeready_templates (name)
select 'Standard turn'
where not exists (select 1 from public.makeready_templates where name = 'Standard turn');

insert into public.makeready_templates (name)
select 'Senior unit turn'
where not exists (select 1 from public.makeready_templates where name = 'Senior unit turn');

insert into public.makeready_template_items (template_id, label, sort)
select t.id, v.label, v.sort
from public.makeready_templates t
cross join (values
  ('Final walkthrough & document condition', 0),
  ('Change locks / rekey', 1),
  ('Patch and paint walls', 2),
  ('Deep clean unit', 3),
  ('Clean carpets / refinish floors', 4),
  ('Test appliances & HVAC', 5),
  ('Replace HVAC filter & smoke detector batteries', 6),
  ('Inspect plumbing for leaks', 7),
  ('Final inspection — ready to lease', 8)
) as v(label, sort)
where t.name = 'Standard turn'
  and not exists (
    select 1 from public.makeready_template_items i where i.template_id = t.id
  );

insert into public.makeready_template_items (template_id, label, sort)
select t.id, v.label, v.sort
from public.makeready_templates t
cross join (values
  ('Final walkthrough & document condition', 0),
  ('Change locks / rekey', 1),
  ('Patch and paint walls', 2),
  ('Deep clean unit', 3),
  ('Install / test grab bars & rails', 4),
  ('Verify accessible fixtures & lever handles', 5),
  ('Test appliances & HVAC', 6),
  ('Replace HVAC filter & smoke detector batteries', 7),
  ('Test emergency pull cords / call system', 8),
  ('Final inspection — ready to lease', 9)
) as v(label, sort)
where t.name = 'Senior unit turn'
  and not exists (
    select 1 from public.makeready_template_items i where i.template_id = t.id
  );

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.maintenance_comments      enable row level security;
alter table public.makeready_templates        enable row level security;
alter table public.makeready_template_items   enable row level security;
alter table public.makeready_turns            enable row level security;
alter table public.makeready_tasks            enable row level security;

-- maintenance_comments -------------------------------------------------------
-- Staff: full read/write. Residents: read non-internal comments on their own
-- request and insert non-internal comments on their own request.
create policy "maintenance_comments: staff read all"
  on public.maintenance_comments for select
  using (public.is_staff());

create policy "maintenance_comments: resident reads non-internal on own request"
  on public.maintenance_comments for select
  using (
    internal = false
    and exists (
      select 1 from public.maintenance_requests r
      where r.id = request_id and r.created_by = auth.uid()
    )
  );

create policy "maintenance_comments: staff write"
  on public.maintenance_comments for insert
  with check (public.is_staff() and author_id = auth.uid());

create policy "maintenance_comments: resident comments on own request"
  on public.maintenance_comments for insert
  with check (
    author_id = auth.uid()
    and internal = false
    and exists (
      select 1 from public.maintenance_requests r
      where r.id = request_id and r.created_by = auth.uid()
    )
  );

create policy "maintenance_comments: staff update"
  on public.maintenance_comments for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "maintenance_comments: staff delete"
  on public.maintenance_comments for delete
  using (public.is_staff());

-- make-ready tables: staff-only for everything --------------------------------
create policy "makeready_templates: staff all"
  on public.makeready_templates for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "makeready_template_items: staff all"
  on public.makeready_template_items for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "makeready_turns: staff all"
  on public.makeready_turns for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "makeready_tasks: staff all"
  on public.makeready_tasks for all
  using (public.is_staff())
  with check (public.is_staff());
