-- =============================================================================
-- Ficco Properties — 0053 repayment plan e-signatures
-- Both parties can sign the Rent Repayment Agreement electronically (typed
-- name + checkbox, UETA-style): tenant signs from the portal (with captured
-- IP/user-agent + snapshotted attestation), landlord countersigns in admin.
-- When both have signed, the executed copy is emailed to both sides.
-- =============================================================================

alter table public.repayment_plans
  add column if not exists tenant_signed_name     text,
  add column if not exists tenant_signed_at       timestamptz,
  add column if not exists tenant_signed_ip       text,
  add column if not exists tenant_signed_ua       text,
  add column if not exists tenant_attestation     text,
  add column if not exists landlord_signed_name   text,
  add column if not exists landlord_signed_at     timestamptz,
  add column if not exists executed_email_sent_at timestamptz;
