-- =============================================================================
-- 38th Ave Properties — 0055 tenancy history (move-out archive)
--
-- unit_occupancy holds exactly ONE row per unit: the household living there
-- now. Sixty-odd screens read it as "the current tenant" — the rent board,
-- billing, notices, reminders, owner reports, anniversaries. So the only way a
-- move-out reads correctly everywhere is for that row to go away.
--
-- This table is where it goes. The tenancy is copied here on move-out, so the
-- unit reads vacant everywhere at once while the record of who lived there —
-- their dates, rent, deposit, forwarding address — survives for the deposit
-- disposition, the unit's history, and any dispute later.
-- =============================================================================

create table if not exists public.tenancy_history (
  id                   uuid primary key default gen_random_uuid(),
  unit_id              uuid not null references public.units (id) on delete cascade,
  occupant_profile_id  uuid references public.profiles (id) on delete set null,

  -- snapshot of the tenancy as it stood at move-out
  tenant_name          text,
  tenant_email         text,
  tenant_phone         text,
  rent_cents           integer,
  deposit_cents        integer,
  move_in_date         date,
  move_out_date        date,
  lease_start_date     date,
  lease_end_date       date,
  forwarding_address   text,
  notes                text,

  -- why it ended, in the office's words
  move_out_reason      text,
  ended_by             uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists tenancy_history_unit_idx
  on public.tenancy_history (unit_id, move_out_date desc);
create index if not exists tenancy_history_profile_idx
  on public.tenancy_history (occupant_profile_id);

alter table public.tenancy_history enable row level security;

-- Staff-only: this is office history, not resident-facing.
create policy "tenancy_history: staff all"
  on public.tenancy_history for all
  using (public.is_staff()) with check (public.is_staff());

-- The unit log gains a 'tenancy' kind so a move-out lands in the unit's
-- timeline alongside notes and maintenance.
alter table public.unit_log_entries
  drop constraint if exists unit_log_entries_kind_check;
alter table public.unit_log_entries
  add constraint unit_log_entries_kind_check
  check (kind in ('note', 'maintenance', 'tenancy'));
