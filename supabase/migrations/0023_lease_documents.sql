-- =============================================================================
-- Ficco Properties — 0023 lease documents
-- Store scanned/PDF copies of existing signed leases (and renewals) against a
-- unit. Private bucket; staff-only. Uploaded + read server-side via the
-- service-role client, viewed through short-lived signed URLs.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lease-docs', 'lease-docs', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']::text[])
on conflict (id) do nothing;

create table if not exists public.lease_documents (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.units (id) on delete cascade,
  resident_id  uuid references public.profiles (id) on delete set null,
  label        text,
  path         text not null,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists lease_documents_unit_idx on public.lease_documents (unit_id);

alter table public.lease_documents enable row level security;

create policy "lease_documents: staff all"
  on public.lease_documents for all
  using (public.is_staff())
  with check (public.is_staff());
