-- =============================================================================
-- Ficco Properties — 0045 lease renewals & rent-increase center
-- Tracks lease expirations and formal renewal offers: staff creates an offer
-- (new rent, term, effective date), serves/emails the CO 60-day notice, the
-- resident accepts or declines in the portal with a typed e-signature, and an
-- accepted offer is applied to the tenancy (occupancy + active lease) on its
-- effective date.
-- =============================================================================

create table if not exists public.renewal_offers (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id) on delete set null,

  unit_id            uuid not null references public.units (id) on delete cascade,
  resident_id        uuid references public.profiles (id) on delete set null,

  -- terms
  current_rent_cents int not null default 0,
  new_rent_cents     int not null,
  term_months        int not null default 12,      -- 0 = month-to-month
  effective_date     date not null,
  new_end_date       date,                          -- null for month-to-month

  -- workflow
  status             text not null default 'draft'
                     check (status in ('draft','sent','accepted','declined','withdrawn','applied')),
  notice_served_on   date,
  served_method      text,                          -- posted | mailed | personal | email
  sent_at            timestamptz,                   -- offer emailed to tenant

  -- resident response (e-sign)
  accepted_at        timestamptz,
  accepted_by        uuid references public.profiles (id) on delete set null,
  signed_name        text,
  signed_ip          text,
  declined_at        timestamptz,
  decline_reason     text,

  -- application to the tenancy
  applied_at         timestamptz,

  note               text
);

create index if not exists renewal_offers_unit_idx on public.renewal_offers (unit_id);
create index if not exists renewal_offers_status_idx on public.renewal_offers (status);
create index if not exists renewal_offers_resident_idx on public.renewal_offers (resident_id);

alter table public.renewal_offers enable row level security;

-- Staff: everything.
create policy "renewal_offers: staff all"
  on public.renewal_offers for all
  using (public.is_staff()) with check (public.is_staff());

-- Residents: read offers for their own home (direct link, tenancy link, or
-- co-tenant membership). Responses go through a server action, so no
-- resident-side insert/update policies.
create policy "renewal_offers: resident read own"
  on public.renewal_offers for select
  using (
    resident_id = auth.uid()
    or exists (
      select 1 from public.unit_occupancy o
      where o.unit_id = renewal_offers.unit_id
        and o.occupant_profile_id = auth.uid()
    )
    or exists (
      select 1 from public.unit_occupants m
      where m.unit_id = renewal_offers.unit_id
        and m.profile_id = auth.uid()
    )
  );
