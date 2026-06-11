-- =============================================================================
-- Ficco Properties — 0008 harden trigger functions
-- Addresses Supabase security-advisor warnings:
--   * pin search_path on set_updated_at / bump_conversation
--   * revoke REST/RPC EXECUTE on trigger functions (they still fire as triggers)
-- is_staff() and settle_charge() are intentionally left executable (is_staff is
-- used inside RLS policies; settle_charge is the resident pay entrypoint).
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.bump_conversation()
returns trigger language plpgsql set search_path = public as $$
begin
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.bump_conversation() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_role() from public, anon, authenticated;
revoke execute on function public.notify_message_recipient() from public, anon, authenticated;
