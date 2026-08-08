-- =============================================================================
-- Ficco Properties — 0051 growth funnel: waitlist, pre-qualification, analytics
-- The compounding trio for the marketing site: a public vacancy board feeds a
-- pre-qual screen feeds a waitlist you can lean on when a unit turns. Plus
-- funnel_events so drop-off per step is measurable (listing view -> pre-qual ->
-- application start -> complete). Public forms write via the service role in
-- server actions; every table is staff-read-only under RLS.
-- =============================================================================

create table if not exists public.waitlist_entries (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  phone          text,
  -- null = any community
  property_id    uuid references public.properties (id) on delete set null,
  bedrooms       text,          -- 'studio' | '1' | '2' | '3+' | 'any'
  max_rent_cents integer,
  move_in_by     date,
  notes          text,
  status         text not null default 'active',  -- active | contacted | converted | closed
  created_at     timestamptz not null default now()
);

create index if not exists waitlist_entries_status_idx on public.waitlist_entries (status, created_at desc);

create table if not exists public.prequal_submissions (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references public.properties (id) on delete set null,
  move_in      text,
  income_band  text,     -- 'under2x' | '2to3x' | 'over3x'
  occupants    text,
  has_pets     boolean not null default false,
  has_voucher  boolean not null default false,
  had_eviction boolean not null default false,
  passed       boolean not null default false,
  email        text,
  created_at   timestamptz not null default now()
);

create index if not exists prequal_submissions_created_idx on public.prequal_submissions (created_at desc);

create table if not exists public.funnel_events (
  id           uuid primary key default gen_random_uuid(),
  session_id   text not null,
  step         text not null,   -- listing_view | prequal_start | prequal_complete | application_start | application_complete | waitlist_join
  property_id  uuid references public.properties (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists funnel_events_step_idx on public.funnel_events (step, created_at desc);
create index if not exists funnel_events_session_idx on public.funnel_events (session_id);

alter table public.waitlist_entries enable row level security;
alter table public.prequal_submissions enable row level security;
alter table public.funnel_events enable row level security;

create policy "waitlist_entries: staff all"
  on public.waitlist_entries for all
  using (public.is_staff()) with check (public.is_staff());

create policy "prequal_submissions: staff all"
  on public.prequal_submissions for all
  using (public.is_staff()) with check (public.is_staff());

create policy "funnel_events: staff read"
  on public.funnel_events for select using (public.is_staff());
