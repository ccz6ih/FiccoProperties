-- =============================================================================
-- Ficco Properties — 0018 vehicles + emergency contact
-- Resident-portal extras: an emergency contact on the profile, and registered
-- vehicles (for parking). Residents manage their own; staff can view.
-- =============================================================================
alter table public.profiles
  add column if not exists emergency_contact_name  text,
  add column if not exists emergency_contact_phone text;

create table if not exists public.vehicles (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  make        text,
  model       text,
  color       text,
  year        int,
  plate       text,
  state       text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists vehicles_profile_idx on public.vehicles (profile_id);

alter table public.vehicles enable row level security;

create policy "vehicles: owner manages own"
  on public.vehicles for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "vehicles: staff read"
  on public.vehicles for select
  using (public.is_staff());
