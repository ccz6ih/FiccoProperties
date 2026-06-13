-- =============================================================================
-- Ficco Properties — 0025 petty cash & receipts
-- One envelope per staffer. Each row is either a 'topup' (cash loaded into the
-- envelope) or an 'expense' (cash spent). For expenses we store BOTH the full
-- receipt total and the business portion (amount_cents) — only the business
-- portion draws down the envelope, so split personal/business receipts are easy.
-- Receipt images live in a private bucket. Visible to all staff + owner.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']::text[])
on conflict (id) do nothing;

create table if not exists public.petty_cash_entries (
  id                 uuid primary key default gen_random_uuid(),
  staff_id           uuid not null references public.profiles (id) on delete cascade,
  kind               text not null default 'expense'
                     check (kind in ('expense','topup')),
  occurred_on        date not null,
  store              text,
  description        text,
  category           text,
  property_id        uuid references public.properties (id) on delete set null,
  unit_id            uuid references public.units (id) on delete set null,
  receipt_total_cents int,
  amount_cents       int not null,
  receipt_path       text,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists petty_cash_staff_idx on public.petty_cash_entries (staff_id);
create index if not exists petty_cash_date_idx on public.petty_cash_entries (occurred_on);

alter table public.petty_cash_entries enable row level security;

create policy "petty_cash: staff all"
  on public.petty_cash_entries for all
  using (public.is_staff())
  with check (public.is_staff());
