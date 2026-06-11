-- =============================================================================
-- Ficco Properties — 0012 split private unit photos into move_in / move_out
-- Both still live in the private unit-condition bucket; listing stays public.
-- Legacy 'condition' kept valid for any pre-existing rows (treated as move-in).
-- Run AFTER 0011.
-- =============================================================================
alter table public.unit_photos drop constraint if exists unit_photos_kind_check;
alter table public.unit_photos
  add constraint unit_photos_kind_check
  check (kind in ('listing', 'condition', 'move_in', 'move_out'));

-- Occupant can read ALL non-listing (private) photos for their unit.
drop policy if exists "unit_photos: occupant reads condition" on public.unit_photos;
create policy "unit_photos: occupant reads private"
  on public.unit_photos for select
  using (
    kind <> 'listing'
    and exists (
      select 1 from public.unit_occupancy o
      where o.unit_id = unit_photos.unit_id and o.occupant_profile_id = auth.uid()
    )
  );
