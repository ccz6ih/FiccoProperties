-- =============================================================================
-- Ficco Properties — 0009 application screening fields + ID-photo bucket
-- Background-check / tenant-screening fields on applications. SSN is NOT
-- collected here — the applicant enters it directly with the screening provider
-- (TransUnion SmartMove), so we never store it. We capture identity + residence
-- + current-landlord contact + signed authorizations, plus a no-pets ack.
-- =============================================================================
alter table public.applications
  add column if not exists date_of_birth            date,
  add column if not exists current_address          text,
  add column if not exists current_residency_length text,
  add column if not exists reason_for_moving        text,
  add column if not exists employer_name            text,
  add column if not exists employer_phone           text,
  add column if not exists landlord_name            text,
  add column if not exists landlord_phone           text,
  add column if not exists landlord_email           text,
  add column if not exists authorize_screening      boolean not null default false,
  add column if not exists authorize_landlord_contact boolean not null default false,
  add column if not exists signature_name           text,
  add column if not exists pets_ack                 boolean not null default false,
  add column if not exists id_photo_path            text,
  add column if not exists screening_status         text not null default 'not_started'
    check (screening_status in ('not_started', 'invited', 'in_progress', 'passed', 'failed', 'waived'));

-- Private bucket for uploaded ID photos. No public access and no anon storage
-- policies: uploads happen server-side with the service-role key, and admins
-- view via short-lived signed URLs. Service role bypasses storage RLS, so the
-- bucket stays locked to everyone else.
insert into storage.buckets (id, name, public)
values ('application-docs', 'application-docs', false)
on conflict (id) do nothing;
