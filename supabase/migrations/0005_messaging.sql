-- =============================================================================
-- Ficco Properties — 0005 messaging realtime + notifications
-- Builds on 0001 (conversations, messages already exist with RLS). Adds:
--   * a composite index on messages(conversation_id, created_at) for thread reads
--   * public.notifications (lightweight per-user notification feed)
--   * realtime publication on messages + notifications
--   * a trigger that notifies the *other* side when a message is sent
-- Run AFTER 0001/0002.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- messages — index for ordered thread reads
-- ---------------------------------------------------------------------------
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null default 'message',
  title      text not null,
  body       text,
  url        text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_read_idx
  on public.notifications (user_id, read_at);

alter table public.notifications enable row level security;

-- A user reads only their own notifications.
create policy "notifications: read own"
  on public.notifications for select
  using (user_id = auth.uid());

-- A user updates only their own notifications (mark as read).
create policy "notifications: update own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Any authenticated user may insert a notification — this lets a sender notify
-- the recipient. (We never expose arbitrary read access, so this is safe.)
create policy "notifications: authenticated insert"
  on public.notifications for insert
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- Notify the other participant on a new message.
-- SECURITY DEFINER so the insert bypasses the recipient's own RLS (the sender
-- is not the recipient). Staff sender -> notify resident; resident sender ->
-- notify all staff. Runs after bump_conversation (alphabetical trigger order
-- is irrelevant here; both are AFTER INSERT and independent).
-- ---------------------------------------------------------------------------
create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv          public.conversations%rowtype;
  sender_name   text;
  sender_role   text;
  preview       text;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  select full_name, role into sender_name, sender_role
    from public.profiles where id = new.sender_id;

  preview := left(new.body, 120);

  if sender_role in ('owner', 'admin') then
    -- staff -> resident
    insert into public.notifications (user_id, type, title, body, url)
    values (
      conv.resident_id,
      'message',
      'New message from the Ficco team',
      preview,
      '/portal/messages/' || conv.id
    );
  else
    -- resident -> every staff member
    insert into public.notifications (user_id, type, title, body, url)
    select p.id,
           'message',
           coalesce(sender_name, 'A resident') || ' sent a message',
           preview,
           '/admin/messages/' || conv.id
      from public.profiles p
     where p.role in ('owner', 'admin');
  end if;

  return new;
end;
$$;

drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient
  after insert on public.messages
  for each row execute function public.notify_message_recipient();

-- ---------------------------------------------------------------------------
-- Realtime — add tables to the supabase_realtime publication, ignoring the
-- "relation is already member" error so the migration is idempotent.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when others then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when others then null;
end;
$$;
