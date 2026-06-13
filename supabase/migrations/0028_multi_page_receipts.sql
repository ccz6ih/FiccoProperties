-- =============================================================================
-- Ficco Properties — 0028 multi-page receipts
-- Allow several files per expense (e.g. a 3-page receipt or photos of each page)
-- and raise the receipts bucket limit for larger multi-page scans/PDFs.
-- =============================================================================
update storage.buckets set file_size_limit = 26214400 where id = 'receipts';

alter table public.petty_cash_entries
  add column if not exists receipt_paths text[];
