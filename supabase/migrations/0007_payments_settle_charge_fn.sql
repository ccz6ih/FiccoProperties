-- =============================================================================
-- Ficco Properties — 0007 settle_charge() function
-- Atomic, secure charge settlement. SECURITY DEFINER so a resident's payment can
-- flip their own charge to 'paid' (charges UPDATE is otherwise staff-only in
-- 0006) while the function itself enforces ownership. Used by the resident pay
-- flow in src/app/(resident)/portal/payments/actions.ts. Run AFTER 0006.
-- =============================================================================
create or replace function public.settle_charge(
  p_charge_id    uuid,
  p_method_id    uuid,
  p_provider_ref text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.charges%rowtype;
begin
  select * into c from public.charges where id = p_charge_id;
  if not found then
    raise exception 'charge not found';
  end if;

  -- Caller must own the charge (or be staff).
  if c.resident_id <> auth.uid() and not public.is_staff() then
    raise exception 'not authorized to settle this charge';
  end if;

  if c.status = 'paid' then
    raise exception 'charge already paid';
  end if;
  if c.status = 'void' then
    raise exception 'charge is void';
  end if;

  insert into public.payments
    (charge_id, resident_id, amount_cents, method_id, provider_ref, status)
  values
    (c.id, c.resident_id, c.amount_cents, p_method_id, p_provider_ref, 'succeeded');

  insert into public.ledger_entries
    (resident_id, lease_id, kind, amount_cents, ref_id, memo)
  values
    (c.resident_id, c.lease_id, 'payment', -c.amount_cents, c.id,
     'Payment for ' || coalesce(c.description, c.period, 'charge'));

  update public.charges set status = 'paid' where id = c.id;
end;
$$;

revoke all on function public.settle_charge(uuid, uuid, text) from public, anon;
grant execute on function public.settle_charge(uuid, uuid, text) to authenticated;
