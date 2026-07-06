-- =============================================================================
-- 38th Ave Properties — 0035 repayment plans
-- Structured rent catch-up agreements (a good-faith offer, and for certain
-- protected tenants a statutory right). A plan is a schedule tracked alongside
-- the rent ledger; recording actual money still happens on the Payments page.
-- =============================================================================
create table if not exists public.repayment_plans (
  id                 uuid primary key default gen_random_uuid(),
  unit_id            uuid references public.units(id) on delete cascade,
  resident_id        uuid references public.profiles(id) on delete set null,
  total_cents        integer not null,
  down_payment_cents integer not null default 0,
  installments       integer not null,
  cadence            text not null default 'monthly',
  start_date         date not null,
  status             text not null default 'active',
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists repayment_plans_unit_idx on public.repayment_plans(unit_id);

create table if not exists public.repayment_plan_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.repayment_plans(id) on delete cascade,
  seq         integer not null,
  due_date    date not null,
  amount_cents integer not null,
  status      text not null default 'open',
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists repayment_plan_items_plan_idx on public.repayment_plan_items(plan_id);

alter table public.repayment_plans enable row level security;
alter table public.repayment_plan_items enable row level security;

create policy "repayment_plans: staff all" on public.repayment_plans
  for all using (public.is_staff()) with check (public.is_staff());
create policy "repayment_plans: resident read own" on public.repayment_plans
  for select using (resident_id = auth.uid());

create policy "repayment_items: staff all" on public.repayment_plan_items
  for all using (public.is_staff()) with check (public.is_staff());
create policy "repayment_items: resident read own" on public.repayment_plan_items
  for select using (exists (
    select 1 from public.repayment_plans p
    where p.id = plan_id and p.resident_id = auth.uid()
  ));
