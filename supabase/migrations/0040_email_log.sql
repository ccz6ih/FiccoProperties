-- =============================================================================
-- 38th Ave Properties — 0040 email delivery log
-- One row per outbound message (keyed by the Resend message id). The Resend
-- webhook (/api/webhooks/resend) updates status as it delivers / opens / bounces
-- so notices can show a live delivery badge. Written only by the service role.
-- =============================================================================
create table if not exists public.email_log (
  id            uuid primary key default gen_random_uuid(),
  message_id    text unique,
  to_email      text,
  subject       text,
  kind          text,
  ref_type      text,
  ref_id        uuid,
  status        text not null default 'sent',
  last_event_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists email_log_ref_idx on public.email_log(ref_type, ref_id);
create index if not exists email_log_message_idx on public.email_log(message_id);

alter table public.email_log enable row level security;
create policy "email_log: staff read" on public.email_log
  for select using (public.is_staff());
