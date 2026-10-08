import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { formatDate, humanize } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Email log" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  to_email: string;
  subject: string;
  kind: string;
  status: string;
  created_at: string;
  last_event_at: string | null;
};

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  failed: { label: "⚠ Did not send", cls: "bg-terracotta/20 text-terracotta-dark font-semibold" },
  bounced: { label: "⚠ Bounced", cls: "bg-terracotta/15 text-terracotta-dark font-semibold" },
  complained: { label: "⚠ Marked spam", cls: "bg-terracotta/15 text-terracotta-dark font-semibold" },
  delivery_delayed: { label: "Delayed…", cls: "bg-gold/15 text-gold" },
  sent: { label: "Sent", cls: "bg-sand text-ink-soft" },
  delivered: { label: "Delivered ✓", cls: "bg-pine/10 text-pine" },
  opened: { label: "Opened 👁", cls: "bg-pine/10 text-pine" },
};

export default async function EmailLog({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { profile } = await requireProfile("/admin/email-log");
  if (!isStaff(profile)) redirect("/portal");

  const { show } = await searchParams;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data } = await db
    .from("email_log")
    .select("id, to_email, subject, kind, status, created_at, last_event_at")
    .order("created_at", { ascending: false })
    .limit(400)
    .returns<Row[]>();

  const all = data ?? [];
  const bad = (r: Row) => ["failed", "bounced", "complained"].includes(r.status);
  const problems = all.filter(bad);
  const rows = show === "problems" ? problems : all;

  // Nothing at all for a day or more is itself the signal — that's what a dead
  // API key looks like from in here.
  const now = new Date();
  const newest = all[0]?.created_at ?? null;
  const hoursQuiet = newest
    ? Math.floor((now.getTime() - new Date(newest).getTime()) / 3_600_000)
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Email log"
        subtitle="Every message the system has tried to send, and what became of it."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Logged" value={String(all.length)} hint="most recent 400" />
        <StatCard
          label="Problems"
          value={String(problems.length)}
          tone={problems.length > 0 ? "terracotta" : undefined}
          hint="failed, bounced or marked spam"
        />
        <StatCard
          label="Last send"
          value={newest ? formatDate(newest) : "—"}
          tone={hoursQuiet != null && hoursQuiet > 36 ? "terracotta" : undefined}
          hint={
            hoursQuiet == null
              ? "nothing logged"
              : hoursQuiet > 36
                ? `${Math.floor(hoursQuiet / 24)} days ago — check the API key`
                : "recent"
          }
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/email-log"
          className={`rounded-lg px-3 py-1.5 font-medium ${
            show !== "problems" ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
          }`}
        >
          Everything
        </Link>
        <Link
          href="/admin/email-log?show=problems"
          className={`rounded-lg px-3 py-1.5 font-medium ${
            show === "problems" ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
          }`}
        >
          Problems only ({problems.length})
        </Link>
      </div>

      {rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">To</th>
                  <th className="px-4 py-2 font-medium">Subject</th>
                  <th className="px-4 py-2 font-medium">Kind</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ui = STATUS_UI[r.status] ?? { label: r.status, cls: "bg-sand text-ink-soft" };
                  return (
                    <tr key={r.id} className={`border-b border-clay/60 align-top ${bad(r) ? "bg-terracotta/5" : ""}`}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft">{r.to_email}</td>
                      <td className="px-4 py-2.5 text-ink">{r.subject}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-faint">
                        {humanize(r.kind)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${ui.cls}`}>
                          {ui.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title={show === "problems" ? "No problems" : "Nothing logged yet"}
          body={
            show === "problems"
              ? "Nothing has failed, bounced or been marked as spam."
              : "Messages appear here as the system sends them."
          }
        />
      )}

      <p className="mt-4 text-xs text-ink-faint">
        A failed row means Resend refused it outright — usually a bad API key or a malformed
        address; the reason is on the end of the subject. Delivered and opened come back from
        Resend&apos;s webhook, so they only appear if that&apos;s still connected.
      </p>
    </div>
  );
}
