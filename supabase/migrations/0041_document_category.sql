-- =============================================================================
-- 38th Ave Properties — 0041 document category
-- Generalize the shared unit-document store (lease_documents) beyond leases:
-- a category (lease | esa | insurance | notice | other) so staff can attach and
-- optionally share ESA letters, insurance, etc. with the resident.
-- =============================================================================
alter table public.lease_documents
  add column if not exists category text not null default 'lease';
