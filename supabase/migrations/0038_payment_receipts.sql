-- =============================================================================
-- 38th Ave Properties — 0038 payment receipts
-- A receipt note (money-order / check #) and an optional scanned receipt image
-- on a payment, so staff can attach proof after recording and the renter sees
-- it in their portal payment history. Private bucket; signed URLs.
-- =============================================================================
alter table public.payments
  add column if not exists receipt_note text,
  add column if not exists receipt_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']::text[])
on conflict (id) do nothing;
