-- =============================================================================
-- Ficco Properties — 0017 profile avatars
-- Profile photos so staff & residents can see who's responding (messages,
-- maintenance, etc). Public bucket; uploads are server-side via the
-- service-role client and the public URL is stored on the profile.
-- =============================================================================
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif']::text[])
on conflict (id) do nothing;
