-- =============================================================================
-- Ficco Properties — 0022 auto-connect accounts to pre-entered tenancies
-- When a profile is created (self-signup, admin invite, anything) or its email
-- changes, link it to any unit_occupancy row that was recorded with the same
-- tenant_email and isn't linked yet. So tenants entered for record-keeping
-- without an account get connected the moment they sign up later.
-- =============================================================================
create or replace function public.link_occupancy_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    update public.unit_occupancy
      set occupant_profile_id = new.id
      where occupant_profile_id is null
        and tenant_email is not null
        and lower(tenant_email) = lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_link_occupancy on public.profiles;
create trigger profiles_link_occupancy
  after insert or update of email on public.profiles
  for each row execute function public.link_occupancy_to_profile();
