-- =============================================================================
-- 38th Ave Properties — 0037 move-out & deposit disposition
-- Resident forwarding address + planned move-out date on the tenancy, and a
-- staff deposit settlement with itemized deductions that computes the refund
-- (Colorado requires a written statement of deductions with the returned
-- deposit within 30 days, or up to 60 if the lease says so).
-- =============================================================================
alter table public.unit_occupancy
  add column if not exists forwarding_address text,
  add column if not exists move_out_date date;

create table if not exists public.deposit_settlements (
  unit_id       uuid primary key references public.units(id) on delete cascade,
  deposit_cents integer not null default 0,
  notes         text,
  status        text not null default 'draft',
  updated_by    uuid references public.profiles(id) on delete set null,
  updated_at    timestamptz not null default now()
);

create table if not exists public.deposit_deductions (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.units(id) on delete cascade,
  description  text not null,
  amount_cents integer not null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists deposit_deductions_unit_idx on public.deposit_deductions(unit_id);

alter table public.deposit_settlements enable row level security;
alter table public.deposit_deductions enable row level security;
create policy "deposit_settlements: staff all" on public.deposit_settlements
  for all using (public.is_staff()) with check (public.is_staff());
create policy "deposit_deductions: staff all" on public.deposit_deductions
  for all using (public.is_staff()) with check (public.is_staff());
