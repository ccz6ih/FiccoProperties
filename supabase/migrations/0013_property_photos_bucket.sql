-- =============================================================================
-- Ficco Properties — 0013 property-photos bucket (community cover photos)
-- Public bucket; properties.hero_image (from 0001) stores the public URL of the
-- selected cover, shown on the homepage card + property page hero.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif']::text[])
on conflict (id) do nothing;
