# Integration notes — Phase 4 (Messaging + Notifications)

## Migration
- `supabase/migrations/0005_messaging.sql` — apply after `0001`/`0002` (and after
  any lower-numbered phases). It:
  - adds index `messages(conversation_id, created_at)`;
  - creates `public.notifications` with RLS (read/update own; insert by any
    authenticated user) and index `notifications(user_id, read_at)`;
  - adds a SECURITY DEFINER trigger `messages_notify_recipient` that inserts a
    notification for the *other* side on each new message (staff→resident, or
    resident→every staff member);
  - adds `messages` and `notifications` to the `supabase_realtime` publication
    (guarded with DO blocks so it's idempotent).
- After applying, **regenerate `src/types/database.ts`** so the new
  `notifications` table is typed. My TS code does not touch `notifications`
  directly (only the SQL trigger does), so nothing in my lane needs tightening,
  but other phases that add notification UI will want the types.

## Nav links to add (you wire these — I did not touch layouts)
- **Admin layout** (`src/app/(admin)/admin/layout.tsx`), add to the `nav` array:
  ```ts
  { href: "/admin/messages", label: "Messages", icon: navIcons.chat },
  ```
  Suggested position: right after Applications. `navIcons.chat` already exists.
- **Resident** "Messages" link already exists (`/portal/messages`) — no change.

## Unread badge (optional, integrator's call)
- Per-conversation unread dots are already rendered inside both inbox pages
  (resident list + admin inbox) — no shell wiring needed for those.
- If you want a global unread **count badge** in the dashboard shell / sidebar:
  count `notifications` where `user_id = auth.uid() and read_at is null`, e.g.
  ```ts
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  ```
  RLS already scopes this to the current user. To make it live, subscribe in a
  client component to `postgres_changes` on `public.notifications` filtered by
  `user_id=eq.<id>` (mirror the pattern in `src/components/messages-thread.tsx`).
  I did not add a bell component because the shell/header are do-not-touch.

## StatusPill
- No new `StatusPill` statuses needed. Messages have no status enum.

## Env vars / dependencies
- **None.** No new npm packages. Realtime uses the existing
  `@/lib/supabase/client` (the browser client already ships with realtime).
- Realtime requires the project's Realtime feature to be enabled (it is, by
  default, on Supabase). The migration adds the two tables to the publication.

## Behavioural / ordering notes
- `conversations` + `messages` already existed in `0001` with correct RLS, so
  security is enforced there. The realtime subscription is filtered by
  `conversation_id` and additionally gated by RLS — a resident never receives
  another resident's rows.
- Resident thread page calls `notFound()` when the conversation can't be read
  (covers both "missing" and "RLS-denied"), satisfying the acceptance criterion
  that a resident can't load another resident's conversation.
- `read_at` is set on thread open via `markConversationRead` server action
  (marks messages NOT sent by the viewer). The unread dots read from this.
- The notification trigger is SECURITY DEFINER so a sender can write a
  notification row to the recipient despite `notifications` RLS. If you prefer
  to move this into the server actions instead of a trigger, the actions are
  `src/app/(resident)/portal/messages/actions.ts` and
  `src/app/(admin)/admin/messages/actions.ts` — but the trigger covers all send
  paths in one place, so I left it in SQL.

## Things I wished I could change in shared files
- The admin nav array (above) — needs the Messages entry.
- (Optional) a global unread bell in `dashboard-shell` / `site-header`.
