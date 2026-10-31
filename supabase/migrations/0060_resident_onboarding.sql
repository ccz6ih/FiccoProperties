-- Guided onboarding for a brand-new resident.
--
-- Three things have to be settled before a lease is worth signing: how they
-- intend to pay, the day they actually move in, and the lease itself. Until
-- now all three happened over the phone and lived in someone's memory, so a
-- new resident's first impression was a login and no instructions.
--
-- move_in_date already exists on unit_occupancy; what was missing was any
-- record that the RESIDENT confirmed it, rather than it being our guess off
-- the application.

alter table unit_occupancy
  add column if not exists payment_preference text,
  add column if not exists payment_preference_set_at timestamptz,
  add column if not exists move_in_confirmed_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'unit_occupancy_payment_preference_check'
  ) then
    alter table unit_occupancy
      add constraint unit_occupancy_payment_preference_check
      check (
        payment_preference is null
        or payment_preference in ('money_order', 'check', 'online')
      );
  end if;
end $$;

-- Everyone already living here has long since been settled in; only tenancies
-- started from here on should see the welcome steps. Without this backfill the
-- whole portal would sprout a "Welcome" step for 150 existing residents.
update unit_occupancy
   set onboarding_completed_at = now()
 where onboarding_completed_at is null
   and occupant_profile_id is not null;

comment on column unit_occupancy.payment_preference is
  'How the resident told us they intend to pay: money_order, check or online.';
comment on column unit_occupancy.move_in_confirmed_at is
  'When the resident themselves confirmed the move-in date — not our guess from the application.';
comment on column unit_occupancy.onboarding_completed_at is
  'When the resident answered both welcome questions (payment and move-in day). The lease carries its own signed_at.';
