"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Staff sends a reply in a conversation. */
export async function sendStaffMessage(form: FormData) {
  const conversationId = form.get("conversation_id") as string;
  const body = (form.get("body") as string)?.trim();
  if (!conversationId || !body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
  });

  revalidatePath(`/admin/messages/${conversationId}`);
  revalidatePath("/admin/messages");
}

/** Mark all messages in a conversation that were NOT sent by me as read. */
export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);
}
