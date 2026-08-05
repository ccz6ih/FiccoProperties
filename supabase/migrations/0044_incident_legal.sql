-- =============================================================================
-- Ficco Properties — 0044 incident reports: legal hardening
-- Makes a submitted report hold up as evidence:
--   • sequential, human log number (IR-00001)
--   • server-set submitted_at + captured IP / user-agent
--   • e-signature: typed name + snapshotted attestation text + signed_at
--   • immutability: content columns can never be edited after insert; a
--     correction is a NEW row linked via supersedes_id (never an overwrite)
--   • frozen document snapshot path (stored privately at submit)
--   • staff-only, append-only incident_notes log
-- =============================================================================

-- --- sequential log number -------------------------------------------------
create sequence if not exists public.incident_log_seq;

alter table public.incident_reports
  add column if not exists log_seq bigint;
alter table public.incident_reports
  alter column log_seq set default nextval('public.incident_log_seq');
alter table public.incident_reports
  add column if not exists log_number text
  generated always as ('IR-' || lpad(log_seq::text, 5, '0')) stored;

-- --- legal metadata --------------------------------------------------------
alter table public.incident_reports
  add column if not exists property_id           uuid references public.properties (id) on delete set null,
  add column if not exists submitted_at          timestamptz not null default now(),
  add column if not exists submitter_ip          text,
  add column if not exists submitter_user_agent  text,
  add column if not exists attestation_text      text,
  add column if not exists signed_name           text,
  add column if not exists signed_at             timestamptz,
  add column if not exists assigned_to           uuid references public.profiles (id) on delete set null,
  add column if not exists attorney_notified_at  timestamptz,
  add column if not exists snapshot_path         text,
  add column if not exists pdf_url               text,
  add column if not exists supersedes_id         uuid references public.incident_reports (id) on delete set null;

create index if not exists incident_reports_property_idx on public.incident_reports (property_id);
create index if not exists incident_reports_supersedes_idx on public.incident_reports (supersedes_id);

-- --- immutability: block edits to resident-submitted content ----------------
-- Workflow/office columns stay editable (status, assigned_to, action_taken,
-- attorney_notified_at, follow_up, admin_notes, reviewed_*, snapshot_path,
-- pdf_url). Everything the resident attested to is frozen.
create or replace function public.incident_reports_no_content_edit()
returns trigger
language plpgsql
as $$
begin
  if row(
      old.reporter_id, old.unit_id, old.property_id, old.reporter_name, old.reporter_phone,
      old.reporter_email, old.occurred_on, old.occurred_time, old.location, old.involved,
      old.narrative, old.anyone_hurt, old.hurt_details, old.police_called, old.police_ref,
      old.has_evidence, old.happened_before, old.before_when, old.additional,
      old.attestation_text, old.signed_name, old.signed_at, old.submitted_at,
      old.submitter_ip, old.submitter_user_agent, old.log_seq, old.log_number,
      old.created_at, old.supersedes_id
    ) is distinct from row(
      new.reporter_id, new.unit_id, new.property_id, new.reporter_name, new.reporter_phone,
      new.reporter_email, new.occurred_on, new.occurred_time, new.location, new.involved,
      new.narrative, new.anyone_hurt, new.hurt_details, new.police_called, new.police_ref,
      new.has_evidence, new.happened_before, new.before_when, new.additional,
      new.attestation_text, new.signed_name, new.signed_at, new.submitted_at,
      new.submitter_ip, new.submitter_user_agent, new.log_seq, new.log_number,
      new.created_at, new.supersedes_id
    )
  then
    raise exception 'incident_reports content is immutable; file a correction as a new linked report';
  end if;
  return new;
end;
$$;

drop trigger if exists incident_reports_immutable on public.incident_reports;
create trigger incident_reports_immutable
  before update on public.incident_reports
  for each row execute function public.incident_reports_no_content_edit();

-- --- staff-only, append-only notes -----------------------------------------
create table if not exists public.incident_notes (
  id           uuid primary key default gen_random_uuid(),
  incident_id  uuid not null references public.incident_reports (id) on delete cascade,
  author_id    uuid references public.profiles (id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists incident_notes_incident_idx on public.incident_notes (incident_id);

alter table public.incident_notes enable row level security;

-- Append-only: staff can read and add, but not edit or delete (no update/delete
-- policy) — so the note log itself is tamper-evident.
create policy "incident_notes: staff read"
  on public.incident_notes for select using (public.is_staff());
create policy "incident_notes: staff insert"
  on public.incident_notes for insert with check (public.is_staff());
