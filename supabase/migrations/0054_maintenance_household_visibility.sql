-- =============================================================================
-- Ficco Properties — 0054 maintenance visibility is per HOME, not per creator
-- Residents could only see requests they personally submitted. So a request
-- staff opened on their behalf (a verbal report, work logged after the fact)
-- was invisible to them, and co-tenants couldn't see each other's. Scope
-- resident reads to their own home instead — bounded by their move-in date so
-- a previous tenant's history is never exposed.
-- =============================================================================

create or replace function public.occupies_unit(target_unit uuid, at_time timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.unit_occupancy o
    where o.unit_id = target_unit
      and (
        o.occupant_profile_id = auth.uid()
        or exists (
          select 1 from public.unit_occupants uo
          where uo.unit_id = o.unit_id and uo.profile_id = auth.uid()
        )
      )
      -- Nothing from before this household moved in.
      and (o.move_in_date is null or at_time >= o.move_in_date::timestamptz)
  );
$$;

-- --- requests ---------------------------------------------------------------
drop policy if exists "maintenance: resident reads own, staff all" on public.maintenance_requests;

create policy "maintenance: household reads home, staff all"
  on public.maintenance_requests for select
  using (
    created_by = auth.uid()
    or public.is_staff()
    or (unit_id is not null and public.occupies_unit(unit_id, created_at))
  );

-- --- comments (non-internal only) -------------------------------------------
drop policy if exists "maintenance_comments: resident reads non-internal on own reques"
  on public.maintenance_comments;

create policy "maintenance_comments: household reads non-internal"
  on public.maintenance_comments for select
  using (
    internal = false
    and exists (
      select 1 from public.maintenance_requests r
      where r.id = maintenance_comments.request_id
        and (
          r.created_by = auth.uid()
          or (r.unit_id is not null and public.occupies_unit(r.unit_id, r.created_at))
        )
    )
  );

-- --- photos -----------------------------------------------------------------
drop policy if exists "maintenance_photos: resident read own" on public.maintenance_photos;

create policy "maintenance_photos: household read"
  on public.maintenance_photos for select
  using (
    exists (
      select 1 from public.maintenance_requests r
      where r.id = maintenance_photos.request_id
        and (
          r.created_by = auth.uid()
          or (r.unit_id is not null and public.occupies_unit(r.unit_id, r.created_at))
        )
    )
  );
