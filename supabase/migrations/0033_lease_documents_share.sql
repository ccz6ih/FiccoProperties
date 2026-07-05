-- =============================================================================
-- 38th Ave Properties — 0033 share lease documents with residents
-- Adds an opt-in flag so staff can publish an uploaded scanned lease to the
-- resident's portal (/portal/lease). Files stay in the private bucket; the
-- portal signs a short-lived URL server-side for shared docs only.
-- =============================================================================
alter table public.lease_documents
  add column if not exists shared_with_resident boolean not null default false;

-- A resident may read the rows for their own shared documents.
drop policy if exists "lease_documents: resident sees shared" on public.lease_documents;
create policy "lease_documents: resident sees shared"
  on public.lease_documents for select
  using (shared_with_resident and resident_id = auth.uid());
