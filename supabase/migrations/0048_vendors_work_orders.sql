-- =============================================================================
-- Ficco Properties — 0048 vendor directory & work orders
-- Contractors/vendors with insurance (COI) expiration + W-9 tracking, vendor
-- assignment on maintenance requests, an emailed work order, and completion
-- cost capture (into unit_costs, so it flows to unit history + financials).
-- =============================================================================

create table if not exists public.vendors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  trade          text,
  phone          text,
  email          text,
  notes          text,
  coi_expires_on date,
  w9_on_file     boolean not null default false,
  active         boolean not null default true,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists vendors_active_idx on public.vendors (active);

alter table public.vendors enable row level security;

create policy "vendors: staff all"
  on public.vendors for all
  using (public.is_staff()) with check (public.is_staff());

alter table public.maintenance_requests
  add column if not exists vendor_id uuid references public.vendors (id) on delete set null,
  add column if not exists work_order_sent_at timestamptz;

create index if not exists maintenance_requests_vendor_idx on public.maintenance_requests (vendor_id);
