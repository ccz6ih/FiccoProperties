import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { MessagesNew } from "@/components/messages-new";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ConversationRow = {
  id: string;
  subject: string;
  last_message_at: string;
  messages: {
    body: string;
    created_at: string;
    sender_id: string;
    read_at: string | null;
  }[];
};

export default async function MessagesPage() {
  const { user } = await requireProfile("/portal/messages");
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, subject, last_message_at, messages(body, created_at, sender_id, read_at)")
    .eq("resident_id", user.id)
    .order("last_message_at", { ascending: false })
    .returns<ConversationRow[]>();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Messages"
        subtitle="Talk directly with the on-site team."
        action={<MessagesNew />}
      />

      {conversations && conversations.length > 0 ? (
        <ul className="space-y-3">
          {conversations.map((c) => {
            const sorted = [...(c.messages ?? [])].sort(
              (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
            );
            const last = sorted[sorted.length - 1];
            const unread = sorted.filter(
              (m) => m.sender_id !== user.id && !m.read_at
            ).length;
            return (
              <li key={c.id}>
                <Link href={`/portal/messages/${c.id}`} className="block">
                  <Card className="p-5 transition-colors hover:bg-sand/30">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {unread > 0 && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-terracotta" />
                        )}
                        <span className="font-medium text-ink">{c.subject}</span>
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
          title="No messages yet"
          body="Reach out any time — questions about your lease, the building, or your neighborhood. Start a new message above."
        />
      )}
    </div>
  );
}
