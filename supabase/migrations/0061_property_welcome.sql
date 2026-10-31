-- An orientation to the community, written once per property.
--
-- A new resident's real questions are the small ones: where does the trash go,
-- where do I park, is there laundry, who pays the gas. Those answers differ by
-- community and none of them were anywhere in the system, so every new tenant
-- got them over the phone, slightly differently each time.
--
-- welcome_facts is a list of {label, value} pairs rather than fixed columns so
-- each community can carry what's actually true of it — laundry at one, a
-- shared yard at another — without a migration every time something is added.

alter table properties
  add column if not exists welcome_note text,
  add column if not exists welcome_facts jsonb not null default '[]'::jsonb;

comment on column properties.welcome_note is
  'A short warm paragraph shown to a new resident on their welcome page.';
comment on column properties.welcome_facts is
  'Orientation facts for new residents: [{"label":"Laundry","value":"Hookups in the basement"}]. Staff-edited, resident-visible.';
