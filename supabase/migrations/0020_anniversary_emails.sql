-- =============================================================================
-- Ficco Properties — 0020 anniversary congrats emails
-- Dedupe ledger so a resident receives at most one move-in anniversary email
-- per calendar year, whether sent by the daily cron or manually by staff.
-- =============================================================================
create table if not exists public.anniversary_emails (
  id          uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.profiles (id) on delete cascade,
  year        int  not null,
  sent_at     timestamptz not null default now(),
  unique (resident_id, year)
);

create index if not exists anniversary_emails_year_idx
  on public.anniversary_emails (year);

alter table public.anniversary_emails enable row level security;

-- Staff can read/manage; the cron uses the service role (bypasses RLS).
create policy "anniversary_emails: staff all"
  on public.anniversary_emails for all
  using (public.is_staff())
  with check (public.is_staff());
