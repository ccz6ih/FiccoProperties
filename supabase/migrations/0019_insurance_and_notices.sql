-- =============================================================================
-- Ficco Properties — 0019 renters insurance + notices/postings
-- Renters insurance proof on the profile (+ private bucket), and a notices
-- table for printable postings (late rent, pay-or-quit, lease violation,
-- entry, general). Notices are printed/posted, not emailed.
-- =============================================================================
alter table public.profiles
  add column if not exists insurance_provider      text,
  add column if not exists insurance_policy_number text,
  add column if not exists insurance_expires_on    date,
  add column if not exists insurance_doc_path       text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('insurance-docs', 'insurance-docs', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif','application/pdf']::text[])
on conflict (id) do nothing;

create table if not exists public.notices (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid references public.units (id) on delete set null,
  resident_id   uuid references public.profiles (id) on delete set null,
  lease_id      uuid references public.leases (id) on delete set null,
  type          text not null
                check (type in ('late_rent', 'pay_or_quit', 'lease_violation', 'entry', 'general')),
  title         text not null,
  body          text not null,
  amount_cents  int,
  cure_by       date,
  served_at     date,
  served_method text check (served_method in ('posted', 'mailed', 'hand', 'email', 'portal')),
  status        text not null default 'draft'
                check (status in ('draft', 'served', 'cured', 'expired', 'withdrawn')),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists notices_resident_idx on public.notices (resident_id);
create index if not exists notices_unit_idx on public.notices (unit_id);
create index if not exists notices_status_idx on public.notices (status);

alter table public.notices enable row level security;

create policy "notices: staff all"
  on public.notices for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "notices: resident reads own served"
  on public.notices for select
  using (resident_id = auth.uid() and status <> 'draft');
