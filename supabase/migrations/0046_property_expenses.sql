-- =============================================================================
-- Ficco Properties — 0046 property-level expenses
-- Operating costs that belong to a whole property rather than one unit —
-- insurance, property taxes, mortgage interest, utilities, trash, legal.
-- Together with unit_costs + petty cash these complete the P&L / Schedule E.
-- =============================================================================

create table if not exists public.property_expenses (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  category     text not null default 'other'
               check (category in (
                 'advertising','auto_travel','cleaning_maintenance','insurance',
                 'legal_professional','management_fees','mortgage_interest',
                 'repairs','supplies','taxes','utilities','other'
               )),
  vendor       text,
  memo         text,
  amount_cents int not null,
  incurred_on  date not null default current_date,
  doc_path     text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists property_expenses_property_idx on public.property_expenses (property_id);
create index if not exists property_expenses_date_idx on public.property_expenses (incurred_on);

alter table public.property_expenses enable row level security;

create policy "property_expenses: staff all"
  on public.property_expenses for all
  using (public.is_staff()) with check (public.is_staff());
