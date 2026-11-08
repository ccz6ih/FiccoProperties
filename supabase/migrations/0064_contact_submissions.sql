-- Every contact-form submission, accepted or not.
--
-- The form had no bot protection and auto-replied to whatever address was
-- typed into it. Between 28 Sep and 8 Nov 2026 that sent 40 unsolicited
-- emails to 37 addresses a spammer chose, which is what got the Resend
-- account banned: from the provider's side the domain was simply sending
-- spam to strangers.
--
-- Keeping the rejects as well as the accepts is the point. Without them
-- there's no way to rate limit, and no way to tell whether a quiet week
-- means nobody wrote in or that everything is being silently dropped.

create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  -- Hashed, not raw: enough to rate limit, not a log of who visited.
  ip_hash text,
  name text,
  email text,
  phone text,
  message text,
  -- accepted | rejected_honeypot | rejected_content | rejected_rate
  verdict text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_ip_idx
  on contact_submissions (ip_hash, created_at desc);
create index if not exists contact_submissions_created_idx
  on contact_submissions (created_at desc);

alter table contact_submissions enable row level security;

-- No policies: the table is written and read only through the service-role
-- client. A public form must never be readable by the public.

comment on table contact_submissions is
  'Contact form submissions including rejected ones, for rate limiting and abuse review.';
