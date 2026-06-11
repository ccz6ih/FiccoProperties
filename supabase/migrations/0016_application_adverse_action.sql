-- =============================================================================
-- Ficco Properties — 0016 adverse-action tracking
-- When an applicant is DENIED based (in whole or part) on a consumer/screening
-- report, the FCRA requires an adverse-action notice. This stamps when staff
-- have sent it, so the dashboard can flag denied applications that still owe one.
-- =============================================================================
alter table public.applications
  add column if not exists adverse_action_sent_at timestamptz;
