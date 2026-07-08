-- =============================================================================
-- 38th Ave Properties — 0039 co-tenant accounts
-- Allow multiple resident accounts to be linked to one unit (co-tenants who each
-- want their own login). unit_occupancy stays the single household record;
-- unit_occupants is the many-to-many of accounts that can access the unit.
-- =============================================================================
create table if not exists public.unit_occupants (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.units(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (unit_id, profile_id)
);
create index if not exists unit_occupants_profile_idx on public.unit_occupants(profile_id);
create index if not exists unit_occupants_unit_idx on public.unit_occupants(unit_id);

insert into public.unit_occupants (unit_id, profile_id, is_primary)
select unit_id, occupant_profile_id, true
from public.unit_occupancy
where occupant_profile_id is not null
on conflict (unit_id, profile_id) do nothing;

alter table public.unit_occupants enable row level security;
create policy "unit_occupants: staff all" on public.unit_occupants
  for all using (public.is_staff()) with check (public.is_staff());
create policy "unit_occupants: resident reads own" on public.unit_occupants
  for select using (profile_id = auth.uid());
