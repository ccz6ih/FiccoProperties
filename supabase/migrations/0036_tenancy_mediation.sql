-- =============================================================================
-- 38th Ave Properties — 0036 tenancy mediation & contact
-- Voluntary program-enrollment disclosure (SSI / SSDI / Colorado Works) + best
-- emergency contact, captured on the tenancy so mandatory-mediation eligibility
-- (C.R.S. § 13-40-106(2)) is known up front rather than surfacing mid-eviction.
-- =============================================================================
alter table public.unit_occupancy
  add column if not exists assistance_programs text[] not null default '{}',
  add column if not exists assistance_disclosed_at date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;
