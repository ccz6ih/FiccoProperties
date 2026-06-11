import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { MessagesThread, type ThreadMessage } from "@/components/messages-thread";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendMessage, markConversationRead } from "../actions";

type ConversationRow = { id: string; subject: string; resident_id: string };
type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
};

export default async function ResidentThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireProfile(`/portal/messages/${id}`);
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, subject, resident_id")
    .eq("id", id)
    .maybeSingle<ConversationRow>();

  // RLS prevents reading another resident's conversation; treat as not found.
  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .returns<ThreadMessage[]>();

  // Resolve sender names + avatars + which senders are staff. Include the
  // conversation's resident so their avatar is available even before they post.
  const senderIds = Array.from(
    new Set([
      ...(messages ?? []).map((m) => m.sender_id),
      conversation.resident_id,
    ])
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .in("id", senderIds.length ? senderIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<ProfileRow[]>();

  const senderNames: Record<string, string> = {};
  const senders: Record<string, { name: string | null; avatarUrl: string | null }> = {};
  const staffIds: string[] = [];
  for (const p of profiles ?? []) {
    senderNames[p.id] = p.full_name ?? "Ficco team";
    senders[p.id] = { name: p.full_name, avatarUrl: p.avatar_url };
    if (p.role === "owner" || p.role === "admin") staffIds.push(p.id);
  }

  await markConversationRead(id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={conversation.subject}
        subtitle="Replies from the Ficco team appear here live."
      />
      <Link
        href="/portal/messages"
        className="mb-4 inline-block text-sm font-medium text-pine hover:text-pine-dark"
      >
        ← All messages
      </Link>

      <Card className="p-5">
        <MessagesThread
          conversationId={id}
          currentUserId={user.id}
          staffIds={staffIds}
          initialMessages={messages ?? []}
          senderNames={senderNames}
          senders={senders}
          sendAction={sendMessage}
        />
      </Card>
    </div>
  );
}
