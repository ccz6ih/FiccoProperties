import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type ConversationRow = Tables<"conversations"> & {
  messages: { body: string; created_at: string }[];
};

export default async function MessagesPage() {
  const { user } = await requireProfile("/portal/messages");
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, messages(body, created_at)")
    .eq("resident_id", user.id)
    .order("last_message_at", { ascending: false })
    .returns<ConversationRow[]>();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Messages"
        subtitle="Talk directly with the Ficco on-site team."
      />

      {conversations && conversations.length > 0 ? (
        <ul className="space-y-3">
          {conversations.map((c) => {
            const last = c.messages?.[c.messages.length - 1];
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-ink">{c.subject}</div>
                  <div className="text-xs text-ink-faint">
                    {formatDate(c.last_message_at)}
                  </div>
                </div>
                {last && (
                  <p className="mt-1 text-sm text-ink-soft line-clamp-1">{last.body}</p>
                )}
              </Card>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No messages yet"
          body="Reach out any time — questions about your lease, the building, or your neighborhood. Direct messaging arrives in the next update."
        />
      )}
    </div>
  );
}
