-- Ficco Properties — 0030 labor rate on unit costs (hours x rate)
alter table public.unit_costs add column if not exists rate_cents int;
