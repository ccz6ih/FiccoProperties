-- =============================================================================
-- Ficco Properties — 0032 unit-based charges
-- Bill by occupancy, not just active leases: allow charges/payments/ledger to be
-- tied to a UNIT without requiring a resident account or a formal lease, so
-- record-only and month-to-month occupied units can be charged and tracked.
-- =============================================================================
alter table public.charges alter column lease_id drop not null;
alter table public.charges alter column resident_id drop not null;
alter table public.charges add column if not exists unit_id uuid references public.units (id) on delete cascade;
create index if not exists charges_unit_idx on public.charges (unit_id);

alter table public.payments alter column resident_id drop not null;
alter table public.payments add column if not exists unit_id uuid references public.units (id) on delete set null;

alter table public.ledger_entries alter column resident_id drop not null;
alter table public.ledger_entries add column if not exists unit_id uuid references public.units (id) on delete set null;
