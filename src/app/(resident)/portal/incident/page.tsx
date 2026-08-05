import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { IncidentReportForm } from "@/components/incident-report-form";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";

type PastRow = {
  id: string;
  log_number: string | null;
  created_at: string;
  occurred_on: string | null;
  status: string;
  narrative: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  new: "Received",
  reviewed: "Reviewed",
  action_taken: "Action taken",
  closed: "Closed",
};

export default async function PortalIncidentPage({
  searchParams,
}: {
  searchParams: Promise<{ corrects?: string }>;
}) {
  const { corrects } = await searchParams;
  const { user, profile } = await requireProfile("/portal/incident");
  const supabase = await createClient();
  // Loose handle — new tables aren't in the generated types yet. Resident reads
  // stay on the user-scoped client so RLS ("read your own") applies.
  const db = supabase as unknown as SupabaseClient;
  const admin = createAdminClient() as unknown as SupabaseClient;

  const unitId = await getResidentUnitId(user.id);
  let home = "Your home";
  if (unitId) {
    const { data: unit } = await admin
      .from("units")
      .select("label, properties(name)")
      .eq("id", unitId)
      .maybeSingle<{ label: string; properties: { name: string | null } | null }>();
    if (unit) home = `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`;
  }

  const { data: past } = await db
    .from("incident_reports")
    .select("id, log_number, created_at, occurred_on, status, narrative")
    .eq("reporter_id", user.id)
    .order("created_at", { ascending: false })
    .returns<PastRow[]>();

  // Only honor a correction link to the resident's OWN report.
  const correctsId = corrects && (past ?? []).some((r) => r.id === corrects) ? corrects : undefined;
  const correctsLog = correctsId ? (past ?? []).find((r) => r.id === correctsId)?.log_number : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Report an incident"
        subtitle="Document a safety event, dispute, or damage. It's kept on file and our team is notified right away."
      />

      {correctsId && (
        <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
          You&apos;re filing a <strong>correction / addendum</strong> to {correctsLog ?? "an earlier report"}.
          Your original report stays on file unchanged.
        </div>
      )}

      <IncidentReportForm
        correctsId={correctsId}
        defaults={{
          name: profile?.full_name ?? "",
          phone: profile?.phone ?? "",
          email: user.email ?? "",
          home,
        }}
      />

      {past && past.length > 0 && (
        <Card className="mt-8 p-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Your past reports</h2>
          <ul className="divide-y divide-clay">
            {past.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink">
                    {r.log_number ? <span className="font-medium text-ink">{r.log_number} · </span> : null}
                    {r.narrative ? r.narrative.slice(0, 70) : "Incident report"}
                    {r.narrative && r.narrative.length > 70 ? "…" : ""}
                  </div>
                  <div className="text-xs text-ink-faint">
                    Filed {formatDate(r.created_at)}
                    {r.occurred_on ? ` · occurred ${formatDate(r.occurred_on)}` : ""}
                    {" · "}
                    <Link href={`/portal/incident?corrects=${r.id}`} className="text-pine hover:underline">
                      File a correction
                    </Link>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        Need something else?{" "}
        <Link href="/portal/tenancy" className="font-medium text-pine hover:text-pine-dark">
          Back to your tenancy
        </Link>
      </p>
    </div>
  );
}
