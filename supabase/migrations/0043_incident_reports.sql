-- =============================================================================
-- Ficco Properties — 0043 resident incident reports
-- A resident-submitted, timestamped incident report (safety events, disputes,
-- damage) with optional photos — kept on file to protect owners. Residents fill
-- it out in the portal; staff see a log with office-use fields. Photos live in a
-- private bucket, viewed via signed URLs.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('incident-photos', 'incident-photos', false, 26214400,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']::text[])
on conflict (id) do nothing;

create table if not exists public.incident_reports (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),

  -- who reported (account + a snapshot of contact info in case it changes)
  reporter_id        uuid references public.profiles (id) on delete set null,
  unit_id            uuid references public.units (id) on delete set null,
  reporter_name      text,
  reporter_phone     text,
  reporter_email     text,

  -- when / where
  occurred_on        date,
  occurred_time      text,
  location           text,

  -- who + what
  involved           text,
  narrative          text,

  -- quick questions
  anyone_hurt        text,           -- 'no' | 'yes'
  hurt_details       text,
  police_called      text,           -- 'no' | 'unknown' | 'yes'
  police_ref         text,
  has_evidence       boolean not null default false,
  happened_before    text,           -- 'no' | 'yes'
  before_when        text,
  additional         text,

  -- workflow
  status             text not null default 'new',  -- new | reviewed | action_taken | closed

  -- office use only (staff)
  received_by        text,
  action_taken       text,
  follow_up          text,
  attorney_notified  text,
  admin_notes        text,
  reviewed_by        uuid references public.profiles (id) on delete set null,
  reviewed_at        timestamptz
);

create index if not exists incident_reports_reporter_idx on public.incident_reports (reporter_id);
create index if not exists incident_reports_unit_idx on public.incident_reports (unit_id);
create index if not exists incident_reports_status_idx on public.incident_reports (status);

create table if not exists public.incident_report_photos (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.incident_reports (id) on delete cascade,
  path        text not null,
  caption     text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists incident_report_photos_report_idx on public.incident_report_photos (report_id);

alter table public.incident_reports enable row level security;
alter table public.incident_report_photos enable row level security;

-- Staff: full access.
create policy "incident_reports: staff all"
  on public.incident_reports for all
  using (public.is_staff()) with check (public.is_staff());

-- Residents: submit their own, and read their own back.
create policy "incident_reports: resident insert own"
  on public.incident_reports for insert
  with check (reporter_id = auth.uid());

create policy "incident_reports: resident read own"
  on public.incident_reports for select
  using (reporter_id = auth.uid());

create policy "incident_report_photos: staff all"
  on public.incident_report_photos for all
  using (public.is_staff()) with check (public.is_staff());

create policy "incident_report_photos: resident read own"
  on public.incident_report_photos for select
  using (exists (
    select 1 from public.incident_reports r
    where r.id = report_id and r.reporter_id = auth.uid()
  ));
