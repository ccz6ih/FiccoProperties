-- =============================================================================
-- Ficco Properties — 0001 schema + RLS
-- Property management portal for the four Ficco communities on W 38th Ave,
-- Wheat Ridge CO. Run this BEFORE 0002_properties_and_units_seed.sql.
--
-- Audiences / roles:
--   owner    — full control (the Ficco family)
--   admin    — staff: review applications, leases, maintenance, messaging
--   resident — logged-in tenant: own unit, lease, maintenance, messages
--   applicant— a signed-up prospect who hasn't been approved to a unit yet
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Shared updated_at maintainer
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  role        text not null default 'resident'
              check (role in ('owner', 'admin', 'resident', 'applicant')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Staff check, SECURITY DEFINER so RLS policies can call it without recursing
-- back through profiles' own row-level policies.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block non-staff from escalating their own role.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_staff() then
    raise exception 'Only staff may change a profile role';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  type          text not null default 'apartment'
                check (type in ('apartment', 'senior', 'townhome', 'house')),
  address_line1 text,
  city          text,
  state         text,
  postal_code   text,
  description   text,
  amenities     text[] not null default '{}',
  hero_image    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------
create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  label       text not null,
  status      text not null default 'available'
              check (status in ('occupied', 'available', 'make_ready', 'offline')),
  bedrooms    int,
  bathrooms   numeric(3, 1),
  sqft        int,
  rent_cents  int,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (property_id, label)
);

create index if not exists units_property_id_idx on public.units (property_id);
create index if not exists units_status_idx on public.units (status);

create trigger units_set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- applications  (the public front door — anonymous submissions allowed)
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid references public.properties (id) on delete set null,
  unit_id             uuid references public.units (id) on delete set null,
  first_name          text not null,
  last_name           text not null,
  email               text not null,
  phone               text,
  desired_move_in     date,
  household_size      int,
  monthly_income_cents int,
  message             text,
  status              text not null default 'new'
                      check (status in ('new', 'reviewing', 'approved', 'denied', 'withdrawn')),
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_property_idx on public.applications (property_id);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- leases
-- ---------------------------------------------------------------------------
create table if not exists public.leases (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.units (id) on delete restrict,
  resident_id   uuid not null references public.profiles (id) on delete restrict,
  start_date    date not null,
  end_date      date,
  rent_cents    int not null default 0,
  deposit_cents int not null default 0,
  status        text not null default 'draft'
                check (status in ('draft', 'pending_signature', 'active', 'ended', 'terminated')),
  document_url  text,
  signed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists leases_resident_idx on public.leases (resident_id);
create index if not exists leases_unit_idx on public.leases (unit_id);

create trigger leases_set_updated_at
  before update on public.leases
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- maintenance_requests
-- ---------------------------------------------------------------------------
create table if not exists public.maintenance_requests (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid references public.units (id) on delete set null,
  created_by   uuid not null references public.profiles (id) on delete cascade,
  category     text not null default 'general'
               check (category in ('general', 'plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest', 'other')),
  title        text not null,
  description  text,
  priority     text not null default 'normal'
               check (priority in ('low', 'normal', 'high', 'emergency')),
  status       text not null default 'open'
               check (status in ('open', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  assigned_to  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists maintenance_status_idx on public.maintenance_requests (status);
create index if not exists maintenance_created_by_idx on public.maintenance_requests (created_by);

create trigger maintenance_set_updated_at
  before update on public.maintenance_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- conversations + messages  (resident <-> staff threads)
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null default 'New conversation',
  resident_id     uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists conversations_resident_idx on public.conversations (resident_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id);

-- Bump the parent conversation's last_message_at on every new message.
create or replace function public.bump_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
    set last_message_at = now()
    where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles             enable row level security;
alter table public.properties           enable row level security;
alter table public.units                enable row level security;
alter table public.applications         enable row level security;
alter table public.leases               enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.conversations        enable row level security;
alter table public.messages             enable row level security;

-- profiles -------------------------------------------------------------------
create policy "profiles: read own or staff reads all"
  on public.profiles for select
  using (id = auth.uid() or public.is_staff());

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: staff update any"
  on public.profiles for update
  using (public.is_staff())
  with check (public.is_staff());

-- properties -----------------------------------------------------------------
create policy "properties: public read"
  on public.properties for select
  using (true);

create policy "properties: staff write"
  on public.properties for all
  using (public.is_staff())
  with check (public.is_staff());

-- units ----------------------------------------------------------------------
create policy "units: public read"
  on public.units for select
  using (true);

create policy "units: staff write"
  on public.units for all
  using (public.is_staff())
  with check (public.is_staff());

-- applications ---------------------------------------------------------------
create policy "applications: anyone may submit"
  on public.applications for insert
  with check (true);

create policy "applications: read own or staff"
  on public.applications for select
  using (created_by = auth.uid() or public.is_staff());

create policy "applications: staff update"
  on public.applications for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "applications: staff delete"
  on public.applications for delete
  using (public.is_staff());

-- leases ---------------------------------------------------------------------
create policy "leases: resident reads own, staff all"
  on public.leases for select
  using (resident_id = auth.uid() or public.is_staff());

create policy "leases: staff write"
  on public.leases for all
  using (public.is_staff())
  with check (public.is_staff());

-- maintenance_requests -------------------------------------------------------
create policy "maintenance: resident reads own, staff all"
  on public.maintenance_requests for select
  using (created_by = auth.uid() or public.is_staff());

create policy "maintenance: resident creates own"
  on public.maintenance_requests for insert
  with check (created_by = auth.uid());

create policy "maintenance: staff update"
  on public.maintenance_requests for update
  using (public.is_staff())
  with check (public.is_staff());

-- conversations --------------------------------------------------------------
create policy "conversations: resident reads own, staff all"
  on public.conversations for select
  using (resident_id = auth.uid() or public.is_staff());

create policy "conversations: resident creates own"
  on public.conversations for insert
  with check (resident_id = auth.uid());

create policy "conversations: staff update"
  on public.conversations for update
  using (public.is_staff())
  with check (public.is_staff());

-- messages -------------------------------------------------------------------
create policy "messages: participants and staff read"
  on public.messages for select
  using (
    public.is_staff()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.resident_id = auth.uid()
    )
  );

create policy "messages: participants and staff send"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (
      public.is_staff()
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.resident_id = auth.uid()
      )
    )
  );
