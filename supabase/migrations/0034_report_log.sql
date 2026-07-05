-- =============================================================================
-- 38th Ave Properties — 0034 report log
-- Dedupe log for scheduled owner/report emails so a re-run on the same day
-- never double-sends. Written only by the service-role cron job.
-- =============================================================================
create table if not exists public.report_log (
  kind       text not null,
  sent_on    date not null,
  created_at timestamptz not null default now(),
  primary key (kind, sent_on)
);
alter table public.report_log enable row level security;
