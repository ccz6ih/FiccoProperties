-- =============================================================================
-- Ficco Properties — 0029 unit costs (job costing)
-- Outside contractor bills / work orders booked against a unit (carpet, plumber,
-- drywall, paint, labor hours, etc.). Combined with petty-cash expenses tagged to
-- the unit, this gives the true cost to make a unit ready / repair it. Invoices
-- live in a private bucket. Staff-only.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unit-cost-docs', 'unit-cost-docs', false, 26214400,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']::text[])
on conflict (id) do nothing;

create table if not exists public.unit_costs (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.units (id) on delete cascade,
  vendor       text,
  trade        text,
  description  text,
  amount_cents int not null,
  hours        numeric(7,2),
  incurred_on  date not null default current_date,
  doc_path     text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists unit_costs_unit_idx on public.unit_costs (unit_id);

alter table public.unit_costs enable row level security;

create policy "unit_costs: staff all"
  on public.unit_costs for all
  using (public.is_staff())
  with check (public.is_staff());
