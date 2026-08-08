import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { IdeaAdminCard, type AdminIdea } from "@/components/idea-admin-card";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type PostRow = {
  id: string;
  author_id: string | null;
  title: string;
  body: string | null;
  category: string;
  status: string;
  staff_reply: string | null;
  hidden: boolean;
  created_at: string;
};

export default async function AdminIdeas() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: posts }, { data: votes }, { data: authors }] = await Promise.all([
    db
      .from("community_posts")
      .select("id, author_id, title, body, category, status, staff_reply, hidden, created_at")
      .order("created_at", { ascending: false })
      .returns<PostRow[]>(),
    db.from("community_post_votes").select("post_id").returns<{ post_id: string }[]>(),
    db.from("profiles").select("id, full_name, email").returns<{ id: string; full_name: string | null; email: string | null }[]>(),
  ]);

  const voteCount = new Map<string, number>();
  for (const v of votes ?? []) voteCount.set(v.post_id, (voteCount.get(v.post_id) ?? 0) + 1);
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.full_name ?? a.email ?? "Resident"]));

  const list: AdminIdea[] = (posts ?? [])
    .map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      category: p.category,
      status: p.status,
      staff_reply: p.staff_reply,
      hidden: p.hidden,
      votes: voteCount.get(p.id) ?? 0,
      author: p.author_id ? nameById.get(p.author_id) ?? "Resident" : "Resident",
      createdAt: formatDate(p.created_at),
    }))
    .sort((a, b) => b.votes - a.votes);

  const open = list.filter((i) => i.status === "new" || i.status === "considering" || i.status === "planned");
  const closed = list.filter((i) => i.status === "done" || i.status === "not_now");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Community ideas"
        subtitle="What residents want next — most-voted first. Reply, set a status, and the board updates for everyone."
      />

      {list.length === 0 ? (
        <EmptyState
          title="No ideas posted yet"
          body="When residents post to the community idea board, they'll land here for you to respond to."
        />
      ) : (
        <>
          <div className="space-y-4">
            {open.map((i) => (
              <IdeaAdminCard key={i.id} idea={i} />
            ))}
          </div>
          {closed.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 font-display text-base font-semibold text-ink-faint">
                Answered ({closed.length})
              </h2>
              <div className="space-y-4">
                {closed.map((i) => (
                  <IdeaAdminCard key={i.id} idea={i} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
