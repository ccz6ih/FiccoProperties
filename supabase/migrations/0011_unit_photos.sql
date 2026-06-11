-- =============================================================================
-- Ficco Properties — 0011 unit photos
-- Two buckets:
--   unit-photos     (PUBLIC)  — listing/marketing images of vacant units
--   unit-condition  (PRIVATE) — move-in/move-out condition documentation
-- The unit_photos table records each image (which unit, listing vs condition,
-- caption, order). Listing rows are world-readable; condition rows are staff +
-- the unit's current occupant. All writes are staff-only. Uploads happen
-- server-side with the service-role client. Run AFTER 0010.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unit-photos', 'unit-photos', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif']::text[])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unit-condition', 'unit-condition', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif']::text[])
on conflict (id) do nothing;

create table if not exists public.unit_photos (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references public.units (id) on delete cascade,
  kind       text not null default 'listing' check (kind in ('listing', 'condition')),
  path       text not null,
  caption    text,
  sort       int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists unit_photos_unit_idx on public.unit_photos (unit_id);
create index if not exists unit_photos_kind_idx on public.unit_photos (unit_id, kind);

alter table public.unit_photos enable row level security;

create policy "unit_photos: public reads listing"
  on public.unit_photos for select
  using (kind = 'listing');

create policy "unit_photos: staff reads all"
  on public.unit_photos for select
  using (public.is_staff());

create policy "unit_photos: occupant reads condition"
  on public.unit_photos for select
  using (
    kind = 'condition'
    and exists (
      select 1 from public.unit_occupancy o
      where o.unit_id = unit_photos.unit_id and o.occupant_profile_id = auth.uid()
    )
  );

create policy "unit_photos: staff insert"
  on public.unit_photos for insert with check (public.is_staff());
create policy "unit_photos: staff update"
  on public.unit_photos for update using (public.is_staff()) with check (public.is_staff());
create policy "unit_photos: staff delete"
  on public.unit_photos for delete using (public.is_staff());
