-- =============================================================================
-- Ficco Properties — 0027 copy tenancy contact onto the account when it links
-- Extends link_occupancy_to_profile: when a new/updated profile matches a
-- pre-entered tenancy by email, also backfill the profile's phone and name from
-- that tenancy (only when the profile's own field is blank). Runs for every
-- signup path — admin invite and self-signup alike.
-- =============================================================================
create or replace function public.link_occupancy_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_name  text;
begin
  if new.email is not null then
    -- Pull contact info from a matching, not-yet-linked tenancy.
    select tenant_phone, tenant_name
      into v_phone, v_name
      from public.unit_occupancy
      where occupant_profile_id is null
        and tenant_email is not null
        and lower(tenant_email) = lower(new.email)
      limit 1;

    -- Link the tenancy to this account.
    update public.unit_occupancy
      set occupant_profile_id = new.id
      where occupant_profile_id is null
        and tenant_email is not null
        and lower(tenant_email) = lower(new.email);

    -- Backfill the account's blank contact fields from the tenancy.
    if v_phone is not null or v_name is not null then
      update public.profiles
        set phone     = coalesce(phone, v_phone),
            full_name = coalesce(full_name, v_name)
        where id = new.id
          and (phone is null or full_name is null);
    end if;
  end if;
  return new;
end;
$$;
