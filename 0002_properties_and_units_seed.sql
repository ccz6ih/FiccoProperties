-- =============================================================================
-- Ficco Properties — corrected seed (v2)
-- Replaces the placeholder properties from 0001 with the real portfolio and
-- generates all 150 unit records.
--
-- SAFE FOR GREENFIELD ONLY: this clears units + properties first. Run it before
-- any real leases/tenants exist. After that, edit units individually instead.
-- =============================================================================

begin;

-- Clear placeholder data from 0001 (greenfield reset)
delete from public.units;
delete from public.properties;

-- The four Ficco communities on W 38th Ave, Wheat Ridge, CO 80033
insert into public.properties (name, slug, type, address_line1, city, state, postal_code) values
  ('Mountain Village Square Apartments', 'mountain-village-square', 'apartment', '11500 W 38th Ave', 'Wheat Ridge', 'CO', '80033'),
  ('Senior Villa',                       'senior-villa',           'senior',    '11340 W 38th Ave', 'Wheat Ridge', 'CO', '80033'),
  ('Villa Victoria',                     'villa-victoria',         'townhome',  '11250 W 38th Ave', 'Wheat Ridge', 'CO', '80033'),
  ('The Villa',                          'the-villa',              'apartment', '11080 W 38th Ave', 'Wheat Ridge', 'CO', '80033');

-- ---------------------------------------------------------------------------
-- Generate units. Defaulting status = 'occupied' since these are operating,
-- tenanted buildings; flip individual vacancies to 'available' as you go.
-- Labels are sequential placeholders — rename to real unit numbers anytime.
-- ---------------------------------------------------------------------------

-- Mountain Village Square — 61 units
insert into public.units (property_id, label, status)
select p.id, 'Unit ' || g, 'occupied'
from public.properties p, generate_series(1, 61) g
where p.slug = 'mountain-village-square';

-- Senior Villa — 43 units
insert into public.units (property_id, label, status)
select p.id, 'Unit ' || g, 'occupied'
from public.properties p, generate_series(1, 43) g
where p.slug = 'senior-villa';

-- Villa Victoria — 28 total: 27 units + 1 single-family house
insert into public.units (property_id, label, status)
select p.id, 'Unit ' || g, 'occupied'
from public.properties p, generate_series(1, 27) g
where p.slug = 'villa-victoria';

insert into public.units (property_id, label, status, notes)
select p.id, 'House', 'occupied', 'Single-family house on the Villa Victoria parcel'
from public.properties p
where p.slug = 'villa-victoria';

-- The Villa — 18 units
insert into public.units (property_id, label, status)
select p.id, 'Unit ' || g, 'occupied'
from public.properties p, generate_series(1, 18) g
where p.slug = 'the-villa';

commit;

-- ---------------------------------------------------------------------------
-- Verify counts (should read 61 / 43 / 28 / 18, total 150):
--   select pr.name, count(u.*) as units
--   from public.properties pr
--   left join public.units u on u.property_id = pr.id
--   group by pr.name order by pr.name;
-- ---------------------------------------------------------------------------
