-- =============================================================================
-- Ficco Properties — 0015 application screening record
-- Staff record the screening outcome in the dashboard (the report itself lives
-- in TransUnion SmartMove; we store a link + notes + when it was started).
-- =============================================================================
alter table public.applications
  add column if not exists screening_notes        text,
  add column if not exists screening_report_url   text,
  add column if not exists screening_requested_at timestamptz;
