"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotification, notificationHtml } from "@/lib/email";

type ConvRow = {
  subject: string;
  profiles: { email: string | null; full_name: string | null } | null;
};

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

  // Email the resident that the Ficco team replied (delivers once the domain
  // is verified in Resend; no-ops otherwise).
  const { data: conv } = await supabase
    .from("conversations")
    .select("subject, profiles:resident_id(email, full_name)")
    .eq("id", conversationId)
    .maybeSingle<ConvRow>();
  if (conv?.profiles?.email) {
    await sendNotification({
      to: conv.profiles.email,
      subject: `Ficco Properties replied — ${conv.subject}`,
      html: notificationHtml("The Ficco team replied to your message", [
        ["Subject", conv.subject],
        ["Message", body.slice(0, 240)],
        ["View", `https://ficcoproperties.com/portal/messages/${conversationId}`],
      ]),
    });
  }

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
