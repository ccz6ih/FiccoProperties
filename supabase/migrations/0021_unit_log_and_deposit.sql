-- =============================================================================
-- Ficco Properties — 0021 unit notes/service log + deposit on occupancy
-- A free-form back-history per unit: admin notes about a tenant and a record of
-- maintenance performed (separate from resident-submitted maintenance_requests).
-- Plus a deposit field on the tenancy record. Staff-only.
-- =============================================================================
alter table public.unit_occupancy
  add column if not exists deposit_cents int;

create table if not exists public.unit_log_entries (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.units (id) on delete cascade,
  resident_id  uuid references public.profiles (id) on delete set null,
  kind         text not null default 'note'
               check (kind in ('note', 'maintenance')),
  body         text not null,
  performed_on date,
  cost_cents   int,
  author_id    uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists unit_log_entries_unit_idx on public.unit_log_entries (unit_id);
create index if not exists unit_log_entries_resident_idx on public.unit_log_entries (resident_id);

alter table public.unit_log_entries enable row level security;

create policy "unit_log: staff all"
  on public.unit_log_entries for all
  using (public.is_staff())
  with check (public.is_staff());
