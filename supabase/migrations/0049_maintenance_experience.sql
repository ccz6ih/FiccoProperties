-- =============================================================================
-- Ficco Properties — 0049 maintenance experience upgrade
-- Tenant photo uploads on requests, and a scheduled-visit ETA (date + window)
-- so the portal can show a package-tracker style timeline:
-- Submitted → Assigned → Scheduled → Completed.
-- Photos live in the existing private unit-condition bucket.
-- =============================================================================

alter table public.maintenance_requests
  add column if not exists scheduled_for date,
  add column if not exists scheduled_window text;

create table if not exists public.maintenance_photos (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.maintenance_requests (id) on delete cascade,
  path        text not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists maintenance_photos_request_idx on public.maintenance_photos (request_id);

alter table public.maintenance_photos enable row level security;

create policy "maintenance_photos: staff all"
  on public.maintenance_photos for all
  using (public.is_staff()) with check (public.is_staff());

create policy "maintenance_photos: resident read own"
  on public.maintenance_photos for select
  using (exists (
    select 1 from public.maintenance_requests r
    where r.id = request_id and r.created_by = auth.uid()
  ));
