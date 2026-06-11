"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StartState = { ok: boolean; error?: string };

/** Resident starts a new conversation with the office and sends the first message. */
export async function startConversation(
  _prev: StartState,
  form: FormData
): Promise<StartState> {
  const subject = (form.get("subject") as string)?.trim();
  const body = (form.get("body") as string)?.trim();

  if (!subject) return { ok: false, error: "Please add a subject." };
  if (!body) return { ok: false, error: "Please write a message." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({ subject, resident_id: user.id })
    .select("id")
    .single();

  if (convError || !conversation) {
    return { ok: false, error: "Could not start the conversation. Please try again." };
  }

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: user.id,
    body,
  });

  if (msgError) {
    return { ok: false, error: "Could not send your message. Please try again." };
  }

  revalidatePath("/portal/messages");
  redirect(`/portal/messages/${conversation.id}`);
}

/** Send a message in an existing conversation (resident). */
export async function sendMessage(form: FormData) {
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

  revalidatePath(`/portal/messages/${conversationId}`);
  revalidatePath("/portal/messages");
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
