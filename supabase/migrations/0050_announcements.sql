-- =============================================================================
-- Ficco Properties — 0050 building announcements with acknowledge receipts
-- Staff post an announcement (water shutoff, snow removal, pest treatment…)
-- targeted at one or more communities. Residents see it in the portal and tap
-- "Got it" — the receipt (who + when) is the admin evidence artifact.
-- =============================================================================

create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text not null,
  -- null = every community; otherwise the property ids it applies to
  property_ids  uuid[],
  -- optional: hide it from the portal after this date (e.g. day after the work)
  expires_on    date,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists announcements_created_idx on public.announcements (created_at desc);

create table if not exists public.announcement_receipts (
  id               uuid primary key default gen_random_uuid(),
  announcement_id  uuid not null references public.announcements (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  acknowledged_at  timestamptz not null default now(),
  unique (announcement_id, profile_id)
);

create index if not exists announcement_receipts_announcement_idx
  on public.announcement_receipts (announcement_id);

alter table public.announcements enable row level security;
alter table public.announcement_receipts enable row level security;

create policy "announcements: staff all"
  on public.announcements for all
  using (public.is_staff()) with check (public.is_staff());

-- Residents read announcements (community targeting is applied in the app,
-- since a resident's property comes from their occupancy).
create policy "announcements: residents read"
  on public.announcements for select
  using (auth.uid() is not null);

create policy "announcement_receipts: staff read"
  on public.announcement_receipts for select using (public.is_staff());

create policy "announcement_receipts: resident insert own"
  on public.announcement_receipts for insert
  with check (profile_id = auth.uid());

create policy "announcement_receipts: resident read own"
  on public.announcement_receipts for select
  using (profile_id = auth.uid());
