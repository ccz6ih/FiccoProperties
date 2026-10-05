-- =============================================================================
-- 38th Ave Properties — 0059 petty cash: receipt handed over on paper
--
-- A purchase with no uploaded image was reported as "Missing", which is wrong
-- for the receipts handed to the bookkeeper by hand. Undocumented spend and
-- documented-but-not-scanned spend are different things, and an owner reading
-- the report has to be able to tell them apart.
--
-- Safe to run more than once.
-- =============================================================================

alter table public.petty_cash_entries
  add column if not exists receipt_on_paper boolean not null default false;

comment on column public.petty_cash_entries.receipt_on_paper is
  'The paper receipt was handed over rather than uploaded. Counts as documented.';
