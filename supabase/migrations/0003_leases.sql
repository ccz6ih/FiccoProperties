-- =============================================================================
-- Ficco Properties — 0003 leases + e-signature
-- Extends public.leases (defined in 0001) with application linkage, terms text,
-- and signature capture; adds public.lease_events as an append-only audit trail.
-- Run AFTER 0001_ficco_properties_schema.sql.
--
-- Lifecycle: staff create a lease (draft) -> send for signature
-- (pending_signature) -> resident e-signs (active) -> staff end/terminate
-- (ended / terminated). Each step records a row in lease_events.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- leases — new columns
-- ---------------------------------------------------------------------------
alter table public.leases
  add column if not exists application_id uuid
    references public.applications (id) on delete set null,
  add column if not exists terms          text,
  add column if not exists signature_name text,
  add column if not exists signature_ip   text;

create index if not exists leases_application_idx on public.leases (application_id);

-- ---------------------------------------------------------------------------
-- lease_events — audit trail (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.lease_events (
  id          uuid primary key default gen_random_uuid(),
  lease_id    uuid not null references public.leases (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  type        text not null
              check (type in ('created', 'sent', 'signed', 'activated', 'ended', 'terminated', 'note')),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists lease_events_lease_idx on public.lease_events (lease_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.lease_events enable row level security;

-- lease_events ---------------------------------------------------------------
-- Residents read events for their own lease; staff read all.
create policy "lease_events: resident reads own, staff all"
  on public.lease_events for select
  using (
    public.is_staff()
    or exists (
      select 1 from public.leases l
      where l.id = lease_id and l.resident_id = auth.uid()
    )
  );

-- A resident may insert a 'signed' event for their own lease (recorded when
-- they e-sign). Staff may insert any event for any lease.
create policy "lease_events: resident signs own"
  on public.lease_events for insert
  with check (
    actor_id = auth.uid()
    and type = 'signed'
    and exists (
      select 1 from public.leases l
      where l.id = lease_id and l.resident_id = auth.uid()
    )
  );

create policy "lease_events: staff write"
  on public.lease_events for insert
  with check (public.is_staff());

-- leases — resident self-sign update --------------------------------------
-- 0001 already grants staff full write + resident/staff select on leases.
-- Allow a resident to update ONLY their own lease, and only to e-sign it
-- (flip pending_signature -> active and stamp signature fields). The status
-- guard below restricts the resident to that single transition; staff retain
-- their unrestricted "leases: staff write" policy from 0001.
create policy "leases: resident e-signs own"
  on public.leases for update
  using (resident_id = auth.uid() and status = 'pending_signature')
  with check (resident_id = auth.uid() and status = 'active');
