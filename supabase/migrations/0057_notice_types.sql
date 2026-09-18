-- =============================================================================
-- 38th Ave Properties — 0057 allow the notice types the app actually offers
--
-- notices.type was still checked against the original five. Four types added
-- since — the 90-day no-fault and the three JDF 99 B terminations — were
-- rejected by the constraint, so every one of those buttons failed its insert
-- and returned silently. The whole termination feature looked inert.
-- =============================================================================

alter table public.notices drop constraint if exists notices_type_check;
alter table public.notices
  add constraint notices_type_check check (type in (
    'late_rent',
    'pay_or_quit',
    'no_fault_late',
    'terminate_substantial',
    'terminate_repeat',
    'terminate_nonrenewal',
    'lease_violation',
    'entry',
    'general'
  ));
