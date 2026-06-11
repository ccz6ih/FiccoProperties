-- =============================================================================
-- Ficco Properties — 0006 payments (rent charges, ACH-first payments, ledger)
-- Run AFTER 0001_ficco_properties_schema.sql.
--
-- Money model:
--   charges          — what a resident owes (debits)
--   payments         — attempts to settle a charge via a payment method
--   ledger_entries   — append-only source of truth; balance = sum(amount_cents)
--                      positive = owed (charge), negative = paid (payment)
--   payment_methods  — a resident's saved bank account / card (mock provider_ref)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- payment_methods  (a resident's saved ACH bank account / card)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  kind         text not null default 'ach' check (kind in ('ach', 'card')),
  label        text,
  provider_ref text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists payment_methods_profile_idx
  on public.payment_methods (profile_id);

-- ---------------------------------------------------------------------------
-- charges  (what a resident owes, generated from a lease)
-- ---------------------------------------------------------------------------
create table if not exists public.charges (
  id           uuid primary key default gen_random_uuid(),
  lease_id     uuid not null references public.leases (id) on delete cascade,
  resident_id  uuid not null references public.profiles (id),
  amount_cents int not null,
  description  text,
  due_date     date,
  status       text not null default 'open'
               check (status in ('open', 'paid', 'void', 'past_due')),
  period       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists charges_lease_idx on public.charges (lease_id);
create index if not exists charges_resident_status_idx
  on public.charges (resident_id, status);
-- One charge per lease per billing period (keeps generation idempotent).
create unique index if not exists charges_lease_period_uniq
  on public.charges (lease_id, period)
  where period is not null;

create trigger charges_set_updated_at
  before update on public.charges
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payments  (an attempt to settle a charge via a payment method)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  charge_id    uuid references public.charges (id) on delete set null,
  resident_id  uuid not null references public.profiles (id),
  amount_cents int not null,
  method_id    uuid references public.payment_methods (id),
  provider_ref text,
  status       text not null default 'pending'
               check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  created_at   timestamptz not null default now()
);

create index if not exists payments_charge_idx on public.payments (charge_id);
create index if not exists payments_resident_idx on public.payments (resident_id);
create index if not exists payments_method_idx on public.payments (method_id);

-- ---------------------------------------------------------------------------
-- ledger_entries  (append-only source of truth; balance = sum(amount_cents))
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id           uuid primary key default gen_random_uuid(),
  resident_id  uuid not null references public.profiles (id),
  lease_id     uuid references public.leases (id),
  kind         text not null check (kind in ('charge', 'payment', 'adjustment')),
  amount_cents int not null,
  ref_id       uuid,
  memo         text,
  created_at   timestamptz not null default now()
);

create index if not exists ledger_resident_idx on public.ledger_entries (resident_id);
create index if not exists ledger_lease_idx on public.ledger_entries (lease_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.payment_methods enable row level security;
alter table public.charges         enable row level security;
alter table public.payments        enable row level security;
alter table public.ledger_entries  enable row level security;

-- payment_methods ------------------------------------------------------------
create policy "payment_methods: owner reads own, staff all"
  on public.payment_methods for select
  using (profile_id = auth.uid() or public.is_staff());

create policy "payment_methods: owner inserts own"
  on public.payment_methods for insert
  with check (profile_id = auth.uid());

create policy "payment_methods: owner updates own"
  on public.payment_methods for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "payment_methods: owner deletes own"
  on public.payment_methods for delete
  using (profile_id = auth.uid());

-- charges --------------------------------------------------------------------
create policy "charges: resident reads own, staff all"
  on public.charges for select
  using (resident_id = auth.uid() or public.is_staff());

create policy "charges: staff write"
  on public.charges for all
  using (public.is_staff())
  with check (public.is_staff());

-- payments -------------------------------------------------------------------
create policy "payments: resident reads own, staff all"
  on public.payments for select
  using (resident_id = auth.uid() or public.is_staff());

-- A resident may record a payment only for a charge they own.
create policy "payments: resident inserts own"
  on public.payments for insert
  with check (
    resident_id = auth.uid()
    and (
      charge_id is null
      or exists (
        select 1 from public.charges c
        where c.id = charge_id and c.resident_id = auth.uid()
      )
    )
  );

create policy "payments: staff write"
  on public.payments for all
  using (public.is_staff())
  with check (public.is_staff());

-- ledger_entries (append-only) -----------------------------------------------
create policy "ledger: resident reads own, staff all"
  on public.ledger_entries for select
  using (resident_id = auth.uid() or public.is_staff());

-- A resident may append a ledger row only for themselves.
create policy "ledger: resident inserts own"
  on public.ledger_entries for insert
  with check (resident_id = auth.uid());

create policy "ledger: staff insert"
  on public.ledger_entries for insert
  with check (public.is_staff());

create policy "ledger: staff read all"
  on public.ledger_entries for select
  using (public.is_staff());
