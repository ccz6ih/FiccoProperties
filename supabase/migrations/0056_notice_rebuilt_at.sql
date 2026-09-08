-- =============================================================================
-- 38th Ave Properties — 0056 notice rebuild stamp
-- A draft demand can be regenerated from current balances, but nothing recorded
-- that it happened: created_at stays put, so the page kept reporting the draft
-- as written months ago and the button looked broken even when it had worked.
-- =============================================================================

alter table public.notices
  add column if not exists rebuilt_at timestamptz;
