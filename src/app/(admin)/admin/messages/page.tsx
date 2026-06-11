import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type ConversationRow = {
  id: string;
  subject: string;
  resident_id: string;
  last_message_at: string;
  resident: { full_name: string | null } | null;
  messages: {
    body: string;
    created_at: string;
    sender_id: string;
    read_at: string | null;
  }[];
};

export default async function AdminMessages() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      "id, subject, resident_id, last_message_at, resident:profiles!conversations_resident_id_fkey(full_name), messages(body, created_at, sender_id, read_at)"
    )
    .order("last_message_at", { ascending: false })
    .returns<ConversationRow[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Messages"
        subtitle="Every resident conversation in one inbox."
      />

      {conversations && conversations.length > 0 ? (
        <ul className="space-y-3">
          {conversations.map((c) => {
            const sorted = [...(c.messages ?? [])].sort(
              (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
            );
            const last = sorted[sorted.length - 1];
            // Unread = messages from the resident that staff hasn't read.
            const unread = sorted.filter(
              (m) => m.sender_id !== user?.id && m.sender_id === c.resident_id && !m.read_at
            ).length;
            return (
              <li key={c.id}>
                <Link href={`/admin/messages/${c.id}`} className="block">
                  <Card className="p-5 transition-colors hover:bg-sand/30">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {unread > 0 && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-terracotta" />
                        )}
                        <span className="font-medium text-ink">{c.subject}</span>
                        <span className="text-xs text-ink-faint">
                          · {c.resident?.full_name ?? "Resident"}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {formatDate(c.last_message_at)}
                      </span>
                    </div>
                    {last && (
                      <p className="mt-1 text-sm text-ink-soft line-clamp-1">
                        {last.body}
                      </p>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No conversations yet"
          body="When a resident starts a message from their portal, it lands here for the team to answer."
        />
      )}
    </div>
  );
}
