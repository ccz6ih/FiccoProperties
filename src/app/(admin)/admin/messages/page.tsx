import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { Avatar } from "@/components/avatar";
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

type StaffProfile = { id: string; full_name: string | null; avatar_url: string | null };

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

  const list = conversations ?? [];

  // Precompute the last message + who sent it for each conversation.
  const computed = list.map((c) => {
    const sorted = [...(c.messages ?? [])].sort(
      (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
    );
    const last = sorted[sorted.length - 1] ?? null;
    const awaiting = !!last && last.sender_id === c.resident_id; // resident spoke last
    return { c, last, awaiting };
  });

  // Fetch profiles of staff who replied last, so we can show who's handling it.
  const staffIds = [
    ...new Set(
      computed
        .filter((x) => x.last && !x.awaiting)
        .map((x) => x.last!.sender_id)
    ),
  ];
  const staffMap = new Map<string, StaffProfile>();
  if (staffIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", staffIds)
      .returns<StaffProfile[]>();
    for (const p of data ?? []) staffMap.set(p.id, p);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Messages" subtitle="Every resident conversation in one inbox." />

      {computed.length > 0 ? (
        <ul className="space-y-3">
          {computed.map(({ c, last, awaiting }) => {
            const replier = last && !awaiting ? staffMap.get(last.sender_id) : null;
            const repliedByYou = last && last.sender_id === user?.id;
            return (
              <li key={c.id}>
                <Link href={`/admin/messages/${c.id}`} className="block">
                  <Card className="p-5 transition-colors hover:bg-sand/30">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {awaiting && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-terracotta" />
                        )}
                        <span className="truncate font-medium text-ink">{c.subject}</span>
                        <span className="shrink-0 text-xs text-ink-faint">
                          · {c.resident?.full_name ?? "Resident"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {awaiting ? (
                          <span className="rounded-full bg-terracotta-soft px-2.5 py-0.5 text-xs font-medium text-terracotta-dark">
                            Awaiting reply
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-ink-faint">
                            <Avatar
                              size="sm"
                              name={replier?.full_name}
                              url={replier?.avatar_url}
                            />
                            {repliedByYou
                              ? "You replied"
                              : `${replier?.full_name ?? "Staff"} replied`}
                          </span>
                        )}
                        <span className="text-xs text-ink-faint">
                          {formatDate(c.last_message_at)}
                        </span>
                      </div>
                    </div>
                    {last && (
                      <p className="mt-1 text-sm text-ink-soft line-clamp-1">{last.body}</p>
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
