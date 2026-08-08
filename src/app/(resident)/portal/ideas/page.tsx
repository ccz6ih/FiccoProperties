import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { IdeaPostForm } from "@/components/idea-post-form";
import { toggleVote } from "./actions";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PostRow = {
  id: string;
  author_id: string | null;
  title: string;
  body: string | null;
  category: string;
  status: string;
  staff_reply: string | null;
  staff_reply_at: string | null;
  created_at: string;
};

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  upgrade: { label: "Upgrade", emoji: "✨" },
  fix: { label: "Fix it", emoji: "🔧" },
  event: { label: "Community event", emoji: "🎉" },
  idea: { label: "Idea", emoji: "💡" },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  considering: { label: "We're considering it", cls: "bg-gold/20 text-ink" },
  planned: { label: "Planned 📋", cls: "bg-pine/15 text-pine" },
  done: { label: "Done ✅", cls: "bg-pine text-cream" },
  not_now: { label: "Not right now", cls: "bg-sand text-ink-soft" },
};

export default async function IdeasPage() {
  const { user } = await requireProfile("/portal/ideas");
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: posts }, { data: votes }] = await Promise.all([
    db
      .from("community_posts")
      .select("id, author_id, title, body, category, status, staff_reply, staff_reply_at, created_at")
      .order("created_at", { ascending: false })
      .returns<PostRow[]>(),
    db
      .from("community_post_votes")
      .select("post_id, profile_id")
      .returns<{ post_id: string; profile_id: string }[]>(),
  ]);

  const all = posts ?? [];

  // Vote counts + the signed-in resident's votes.
  const voteCount = new Map<string, number>();
  const myVotes = new Set<string>();
  for (const v of votes ?? []) {
    voteCount.set(v.post_id, (voteCount.get(v.post_id) ?? 0) + 1);
    if (v.profile_id === user.id) myVotes.add(v.post_id);
  }

  // Author first names via the service role (profiles are RLS-private between
  // residents) — first name only, kept neighborly.
  const authorIds = [...new Set(all.map((p) => p.author_id).filter((v): v is string => !!v))];
  const nameById = new Map<string, string>();
  if (authorIds.length > 0) {
    const admin = createAdminClient() as unknown as SupabaseClient;
    const { data: authors } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds)
      .returns<{ id: string; full_name: string | null }[]>();
    for (const a of authors ?? []) {
      const first = a.full_name?.trim().split(/\s+/)[0];
      if (first) nameById.set(a.id, first);
    }
  }

  const byVotes = (a: PostRow, b: PostRow) =>
    (voteCount.get(b.id) ?? 0) - (voteCount.get(a.id) ?? 0) ||
    b.created_at.localeCompare(a.created_at);

  const done = all.filter((p) => p.status === "done").sort(byVotes);
  const active = all
    .filter((p) => p.status === "new" || p.status === "considering" || p.status === "planned")
    .sort(byVotes);
  const notNow = all.filter((p) => p.status === "not_now").sort(byVotes);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Community idea board"
        subtitle="What should we upgrade next? Share an idea, +1 your neighbors' — the most-wanted ideas rise to the top."
      />

      <IdeaPostForm />

      {done.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-pine">
            You asked, we did it ✅
          </h2>
          <div className="space-y-3">
            {done.map((p) => (
              <IdeaCard key={p.id} post={p} count={voteCount.get(p.id) ?? 0} voted={myVotes.has(p.id)} author={p.author_id ? nameById.get(p.author_id) : undefined} compact />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">
          On the board {active.length > 0 && <span className="text-sm font-normal text-ink-faint">· most wanted first</span>}
        </h2>
        {active.length > 0 ? (
          <div className="space-y-3">
            {active.map((p) => (
              <IdeaCard key={p.id} post={p} count={voteCount.get(p.id) ?? 0} voted={myVotes.has(p.id)} author={p.author_id ? nameById.get(p.author_id) : undefined} />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-sm text-ink-soft">
            No ideas yet — be the first! Big or small: a bench by the mailboxes, a book box, better
            lighting…
          </Card>
        )}
      </div>

      {notNow.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-base font-semibold text-ink-faint">
            Not right now
          </h2>
          <div className="space-y-3 opacity-75">
            {notNow.map((p) => (
              <IdeaCard key={p.id} post={p} count={voteCount.get(p.id) ?? 0} voted={myVotes.has(p.id)} author={p.author_id ? nameById.get(p.author_id) : undefined} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  post,
  count,
  voted,
  author,
  compact,
}: {
  post: PostRow;
  count: number;
  voted: boolean;
  author?: string;
  compact?: boolean;
}) {
  const cat = CATEGORY_META[post.category] ?? CATEGORY_META.idea;
  const status = STATUS_META[post.status];
  return (
    <Card className={compact ? "p-4" : "p-5"}>
      <div className="flex items-start gap-4">
        {/* Vote button */}
        <form action={toggleVote} className="shrink-0">
          <input type="hidden" name="post_id" value={post.id} />
          <button
            type="submit"
            title={voted ? "Remove your +1" : "+1 this idea"}
            className={`flex h-14 w-12 flex-col items-center justify-center rounded-xl border text-sm font-bold transition ${
              voted
                ? "border-pine bg-pine text-cream"
                : "border-clay-deep bg-white/80 text-ink hover:bg-sand"
            }`}
          >
            <span className="text-xs">▲</span>
            {count}
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base">{cat.emoji}</span>
            <h3 className="font-display text-base font-semibold text-ink">{post.title}</h3>
            {status && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.cls}`}>
                {status.label}
              </span>
            )}
          </div>
          {!compact && post.body && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {post.body}
            </p>
          )}
          <div className="mt-1.5 text-xs text-ink-faint">
            {author ? `${author} · ` : ""}{formatDate(post.created_at)}
          </div>

          {post.staff_reply && (
            <div className="mt-3 rounded-xl border border-pine/25 bg-pine/5 px-3.5 py-2.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-pine">
                From the owners
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{post.staff_reply}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
