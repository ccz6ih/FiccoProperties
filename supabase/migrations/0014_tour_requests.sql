-- =============================================================================
-- Ficco Properties — 0014 tour_requests
-- Public "request a tour" submissions (anonymous, like applications). Staff
-- review/schedule them in the admin.
-- =============================================================================
create table if not exists public.tour_requests (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid references public.properties (id) on delete set null,
  name           text not null,
  email          text not null,
  phone          text,
  preferred_date date,
  preferred_time text,
  message        text,
  status         text not null default 'new'
                 check (status in ('new', 'scheduled', 'completed', 'cancelled')),
  created_at     timestamptz not null default now()
);

create index if not exists tour_requests_status_idx on public.tour_requests (status);
create index if not exists tour_requests_property_idx on public.tour_requests (property_id);

alter table public.tour_requests enable row level security;

create policy "tour_requests: anyone may submit"
  on public.tour_requests for insert with check (true);
create policy "tour_requests: staff read"
  on public.tour_requests for select using (public.is_staff());
create policy "tour_requests: staff update"
  on public.tour_requests for update using (public.is_staff()) with check (public.is_staff());
create policy "tour_requests: staff delete"
  on public.tour_requests for delete using (public.is_staff());
