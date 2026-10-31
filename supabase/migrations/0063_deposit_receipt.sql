-- Recording that the security deposit actually came in.
--
-- unit_occupancy.deposit_cents says what we hold, but nothing said whether it
-- had been handed over, when, or in what form — so the only record of a
-- move-in payment was a line in the rent ledger, and the deposit wasn't in
-- there at all.
--
-- It deliberately does NOT go in `charges`: an open charge is what the
-- delinquency report is built from, and a deposit sitting unpaid for a week
-- before the keys are handed over would put a brand-new resident on the rent
-- board as a debtor.

alter table unit_occupancy
  add column if not exists deposit_received_cents integer,
  add column if not exists deposit_received_on date,
  add column if not exists deposit_reference text;

comment on column unit_occupancy.deposit_received_cents is
  'How much deposit has actually been received — may be less than deposit_cents if it came in parts.';
comment on column unit_occupancy.deposit_received_on is
  'The day the deposit was handed over.';
comment on column unit_occupancy.deposit_reference is
  'Money order or check number the deposit came in on.';
