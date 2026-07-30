-- =============================================================================
-- 38th Ave Properties — 0042 signup capture (phone + claimed unit)
-- New residents self-signing up now provide a phone and the home they're
-- renting; handle_new_user copies both into their profile so staff can match
-- them to the unit (which syncs address + rent). Does not auto-link the unit —
-- staff confirm the match to avoid anyone claiming a home that isn't theirs.
-- =============================================================================
alter table public.profiles
  add column if not exists signup_unit_id uuid references public.units(id) on delete set null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.profiles (id, email, full_name, phone, signup_unit_id)
  values (
    new.id,
    new.email,
    coalesce(meta->>'full_name', meta->>'name'),
    nullif(meta->>'phone', ''),
    case when coalesce(meta->>'signup_unit_id','') ~ '^[0-9a-fA-F-]{36}$'
         then (meta->>'signup_unit_id')::uuid else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
