import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { PrintButton } from "@/components/print-button";
import { IncidentOfficeForm } from "@/components/incident-office-form";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Report = {
  id: string;
  created_at: string;
  reporter_name: string | null;
  reporter_phone: string | null;
  reporter_email: string | null;
  occurred_on: string | null;
  occurred_time: string | null;
  location: string | null;
  involved: string | null;
  narrative: string | null;
  anyone_hurt: string | null;
  hurt_details: string | null;
  police_called: string | null;
  police_ref: string | null;
  has_evidence: boolean;
  happened_before: string | null;
  before_when: string | null;
  additional: string | null;
  status: string;
  received_by: string | null;
  action_taken: string | null;
  follow_up: string | null;
  attorney_notified: string | null;
  admin_notes: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

const HURT = (v: string | null) => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
const POLICE = (v: string | null) =>
  v === "yes" ? "Yes" : v === "unknown" ? "Don't know" : v === "no" ? "No" : "—";

export default async function IncidentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: report } = await db
    .from("incident_reports")
    .select(
      "id, created_at, reporter_name, reporter_phone, reporter_email, occurred_on, occurred_time, location, involved, narrative, anyone_hurt, hurt_details, police_called, police_ref, has_evidence, happened_before, before_when, additional, status, received_by, action_taken, follow_up, attorney_notified, admin_notes, units:unit_id(label, properties(name))"
    )
    .eq("id", id)
    .maybeSingle<Report>();

  if (!report) notFound();

  // Photos — signed URLs from the private bucket.
  const { data: photoRows } = await db
    .from("incident_report_photos")
    .select("id, path, caption")
    .eq("report_id", id)
    .order("created_at", { ascending: true })
    .returns<{ id: string; path: string; caption: string | null }[]>();

  const admin = createAdminClient();
  const photos: { id: string; url: string; caption: string | null }[] = [];
  for (const p of photoRows ?? []) {
    const { data: signed } = await admin.storage
      .from("incident-photos")
      .createSignedUrl(p.path, 3600);
    if (signed?.signedUrl) photos.push({ id: p.id, url: signed.signedUrl, caption: p.caption });
  }

  const home = report.units
    ? `${report.units.properties?.name ?? "—"} · ${report.units.label}`
    : "—";
  const occurred = [
    report.occurred_on ? formatDate(report.occurred_on) : null,
    report.occurred_time,
  ]
    .filter(Boolean)
    .join(" · ") || "Not specified";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="print:hidden">
        <PageHeader
          title="Incident report"
          subtitle={`Filed ${formatDate(report.created_at)} by ${report.reporter_name ?? "a resident"}`}
          action={
            <div className="flex items-center gap-3">
              <Link href="/admin/incidents" className="text-sm font-medium text-pine hover:text-pine-dark">
                ← All incidents
              </Link>
              <PrintButton />
            </div>
          }
        />
      </div>

      {/* Print letterhead */}
      <div className="mb-4 hidden print:block">
        <div className="font-display text-xl font-semibold text-ink">
          38th Ave Properties — Incident report
        </div>
        <div className="text-sm text-ink-soft">Filed {formatDate(report.created_at)}</div>
      </div>

      <Card className="space-y-6 p-6 print:border-0 print:shadow-none sm:p-8">
        <Grid>
          <Field label="Reported by" value={report.reporter_name} />
          <Field label="Home" value={home} />
          <Field label="Phone" value={report.reporter_phone} />
          <Field label="Email" value={report.reporter_email} />
          <Field label="When it happened" value={occurred} />
          <Field label="Where" value={report.location} />
        </Grid>

        <Block label="Who was involved" value={report.involved} />
        <Block label="What happened" value={report.narrative} emphasize />

        <div className="grid gap-4 border-t border-clay pt-5 sm:grid-cols-2">
          <Field label="Anyone hurt?" value={HURT(report.anyone_hurt)} warn={report.anyone_hurt === "yes"} />
          <Field label="Injury details" value={report.hurt_details} />
          <Field label="Police called?" value={POLICE(report.police_called)} warn={report.police_called === "yes"} />
          <Field label="Case / report #" value={report.police_ref} />
          <Field label="Has evidence" value={report.has_evidence ? "Yes — photos/video/texts" : "No"} />
          <Field label="Happened before?" value={report.happened_before === "yes" ? `Yes${report.before_when ? ` · ${report.before_when}` : ""}` : HURT(report.happened_before)} />
        </div>

        {report.additional && <Block label="Anything else" value={report.additional} />}

        {photos.length > 0 && (
          <div className="border-t border-clay pt-5">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Photos ({photos.length})
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption ?? "Incident photo"}
                    className="h-36 w-full rounded-lg border border-clay object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Office use — screen only */}
      <Card className="mt-6 p-6 print:hidden sm:p-8">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">Office use</h2>
        <IncidentOfficeForm
          defaults={{
            id: report.id,
            status: report.status,
            received_by: report.received_by ?? "",
            action_taken: report.action_taken ?? "",
            follow_up: report.follow_up ?? "",
            attorney_notified: report.attorney_notified ?? "",
            admin_notes: report.admin_notes ?? "",
          }}
        />
      </Card>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | null | undefined;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`text-sm font-medium ${warn ? "text-terracotta-dark" : "text-ink"}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function Block({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string | null | undefined;
  emphasize?: boolean;
}) {
  return (
    <div className="border-t border-clay pt-5">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <p className={`whitespace-pre-wrap text-sm leading-relaxed text-ink ${emphasize ? "font-medium" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}
