# Phase 4 — Resident ⇄ staff messaging (realtime) + notifications

**Read `docs/agents/CONVENTIONS.md` first and obey it.** You are the Messaging
agent. `conversations` and `messages` tables already exist (see `0001`) with RLS
(resident sees own; staff see all; sender must be a participant). Build the full
two-sided threaded messaging UX with realtime, plus a lightweight notifications
table.

## Goal / user stories

- As a **resident**, I start a conversation with the office, send messages, and
  see staff replies appear live without refreshing. Unread replies are badged.
- As **staff**, I see all conversations in an inbox, open a thread, and reply.
  New resident messages appear live.
- Lightweight **notifications**: when a message is sent, the other side gets a
  notification row; a bell/badge shows unread counts.

## Migration — `supabase/migrations/0005_messaging.sql`

- Add to `public.messages`: nothing required (it has `read_at`). Add index on
  `messages(conversation_id, created_at)`.
- `public.notifications`: `id`, `user_id uuid references public.profiles(id) on
  delete cascade`, `type text` (e.g. `message`), `title text`, `body text`,
  `url text`, `read_at timestamptz`, `created_at`. RLS: a user reads/updates
  only their own notifications (`user_id = auth.uid()`); inserts allowed for any
  authenticated user (so a sender can notify the recipient) — `with check
  (auth.uid() is not null)`. Index `notifications(user_id, read_at)`.
- Enable realtime on `messages` and `notifications`:
  `alter publication supabase_realtime add table public.messages;`
  `alter publication supabase_realtime add table public.notifications;`
  (Guard with a DO block that ignores "already member" errors.)
- Optional trigger: on new message, insert a `notifications` row for the other
  participant. If a trigger is complex with RLS, instead create the notification
  in the server action — your choice; document it.

## Files you own

- `supabase/migrations/0005_messaging.sql`
- `src/app/(resident)/portal/messages/page.tsx` (replace — conversation list +
  "New message")
- `src/app/(resident)/portal/messages/[id]/page.tsx` (a thread)
- `src/app/(resident)/portal/messages/actions.ts` (start conversation, send)
- `src/app/(admin)/admin/messages/page.tsx` (staff inbox: all conversations)
- `src/app/(admin)/admin/messages/[id]/page.tsx` (staff thread view + reply)
- `src/app/(admin)/admin/messages/actions.ts`
- `src/components/messages-*.tsx` — including a CLIENT component
  `messages-thread.tsx` that subscribes to realtime via
  `@/lib/supabase/client` (`supabase.channel(...).on('postgres_changes', ...)`)
  and appends new rows.
- `docs/agents/integration-phase-4.md`

## Shared — do not touch
Per CONVENTIONS.md. You need a new **admin** nav link **Messages**
(`/admin/messages`). The resident "Messages" link already exists. Put the admin
nav request in your integration file. Do NOT edit layouts. If you want an unread
badge in the shell, describe it in the integration file (integrator wires it).

## UX requirements

- Thread view: messages as left/right bubbles (resident vs staff), sender name +
  time, a composer textarea + Send (optimistic append is fine, realtime
  reconciles). Mark visible messages `read_at` for the current user on open.
- Inbox: list with subject, last message preview, relative time, unread dot.
- Reuse `Card`, `PageHeader`, `EmptyState`, `formatDate`. Sender identity:
  staff messages styled with `pine`, resident with `sand`.
- Realtime must not leak across users — subscribe filtered by `conversation_id`,
  and rely on RLS for security.

## Acceptance

- `npx tsc --noEmit` clean for your files.
- A resident and a staff user can exchange messages in one thread; messages
  appear live on the other side; unread counts work.
- A resident cannot load another resident's conversation (RLS).
