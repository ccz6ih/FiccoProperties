-- =============================================================================
-- Ficco Properties — 0010 unit_occupancy
-- The current tenancy record for a unit. Kept SEPARATE from public.units (which
-- the public website can read) so tenant PII never leaks. occupant_profile_id
-- links the tenant's sign-in account when they have one; tenant_name/email/phone
-- cover existing tenants who haven't signed up yet. One row per unit (1:1).
-- Vacancy itself stays on units.status. Run AFTER 0001.
-- =============================================================================
create table if not exists public.unit_occupancy (
  unit_id             uuid primary key references public.units (id) on delete cascade,
  occupant_profile_id uuid references public.profiles (id) on delete set null,
  tenant_name         text,
  tenant_email        text,
  tenant_phone        text,
  rent_cents          int,
  lease_start_date    date,
  lease_signed_date   date,
  lease_end_date      date,
  move_in_date        date,
  notes               text,
  updated_at          timestamptz not null default now()
);

create index if not exists unit_occupancy_occupant_idx
  on public.unit_occupancy (occupant_profile_id);

create trigger unit_occupancy_set_updated_at
  before update on public.unit_occupancy
  for each row execute function public.set_updated_at();

alter table public.unit_occupancy enable row level security;

create policy "unit_occupancy: staff all"
  on public.unit_occupancy for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "unit_occupancy: resident reads own"
  on public.unit_occupancy for select
  using (occupant_profile_id = auth.uid());
