-- =============================================================================
-- Ficco Properties — 0031 resident documents (admin-only vault)
-- Private files + notes attached to a resident, visible to STAFF ONLY (credit
-- reports, background checks, screening, internal notes). No resident-read
-- policy: tenants never see these. Files live in a private bucket.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resident-docs', 'resident-docs', false, 26214400,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']::text[])
on conflict (id) do nothing;

create table if not exists public.resident_documents (
  id           uuid primary key default gen_random_uuid(),
  resident_id  uuid not null references public.profiles (id) on delete cascade,
  label        text,
  note         text,
  path         text,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists resident_documents_resident_idx
  on public.resident_documents (resident_id);

alter table public.resident_documents enable row level security;

create policy "resident_documents: staff all"
  on public.resident_documents for all
  using (public.is_staff())
  with check (public.is_staff());
