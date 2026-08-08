-- =============================================================================
-- Ficco Properties — 0052 community idea board
-- Residents post upgrade ideas and suggestions, neighbors +1 them, and staff
-- respond with a status (considering / planned / done). The "done" items become
-- a public "you asked, we did it" wall — proof the owners listen.
-- =============================================================================

create table if not exists public.community_posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references public.profiles (id) on delete set null,
  title           text not null,
  body            text,
  category        text not null default 'idea',   -- upgrade | fix | event | idea
  status          text not null default 'new',    -- new | considering | planned | done | not_now
  staff_reply     text,
  staff_reply_at  timestamptz,
  hidden          boolean not null default false, -- moderation: hide without deleting
  created_at      timestamptz not null default now()
);

create index if not exists community_posts_created_idx on public.community_posts (created_at desc);
create index if not exists community_posts_status_idx on public.community_posts (status);

create table if not exists public.community_post_votes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (post_id, profile_id)
);

create index if not exists community_post_votes_post_idx on public.community_post_votes (post_id);

alter table public.community_posts enable row level security;
alter table public.community_post_votes enable row level security;

create policy "community_posts: staff all"
  on public.community_posts for all
  using (public.is_staff()) with check (public.is_staff());

create policy "community_posts: residents read visible"
  on public.community_posts for select
  using (auth.uid() is not null and hidden = false);

create policy "community_posts: residents post own"
  on public.community_posts for insert
  with check (author_id = auth.uid());

create policy "community_post_votes: staff all"
  on public.community_post_votes for all
  using (public.is_staff()) with check (public.is_staff());

create policy "community_post_votes: residents read"
  on public.community_post_votes for select
  using (auth.uid() is not null);

create policy "community_post_votes: residents vote own"
  on public.community_post_votes for insert
  with check (profile_id = auth.uid());

create policy "community_post_votes: residents unvote own"
  on public.community_post_votes for delete
  using (profile_id = auth.uid());
