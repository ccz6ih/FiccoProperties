import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { PrintButton } from "@/components/print-button";
import { IncidentOfficeForm } from "@/components/incident-office-form";
import { IncidentNoteForm } from "@/components/incident-note-form";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Report = {
  id: string;
  log_number: string | null;
  created_at: string;
  submitted_at: string | null;
  submitter_ip: string | null;
  submitter_user_agent: string | null;
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
  attestation_text: string | null;
  signed_name: string | null;
  signed_at: string | null;
  snapshot_path: string | null;
  supersedes_id: string | null;
  status: string;
  received_by: string | null;
  action_taken: string | null;
  follow_up: string | null;
  attorney_notified: string | null;
  admin_notes: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

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
      "id, log_number, created_at, submitted_at, submitter_ip, submitter_user_agent, reporter_name, reporter_phone, reporter_email, occurred_on, occurred_time, location, involved, narrative, anyone_hurt, hurt_details, police_called, police_ref, has_evidence, happened_before, before_when, additional, attestation_text, signed_name, signed_at, snapshot_path, supersedes_id, status, received_by, action_taken, follow_up, attorney_notified, admin_notes, units:unit_id(label, properties(name))"
    )
    .eq("id", id)
    .maybeSingle<Report>();

  if (!report) notFound();

  // Photos, notes, snapshot + linked reports.
  const [{ data: photoRows }, { data: noteRows }, { data: original }, { data: corrections }] =
    await Promise.all([
      db
        .from("incident_report_photos")
        .select("id, path, caption")
        .eq("report_id", id)
        .order("created_at", { ascending: true })
        .returns<{ id: string; path: string; caption: string | null }[]>(),
      db
        .from("incident_notes")
        .select("id, body, created_at, author:author_id(full_name)")
        .eq("incident_id", id)
        .order("created_at", { ascending: true })
        .returns<{ id: string; body: string; created_at: string; author: { full_name: string | null } | null }[]>(),
      report.supersedes_id
        ? db.from("incident_reports").select("id, log_number").eq("id", report.supersedes_id).maybeSingle<{ id: string; log_number: string | null }>()
        : Promise.resolve({ data: null }),
      db.from("incident_reports").select("id, log_number").eq("supersedes_id", id).returns<{ id: string; log_number: string | null }[]>(),
    ]);

  const admin = createAdminClient();
  const photos: { id: string; url: string; caption: string | null }[] = [];
  for (const p of photoRows ?? []) {
    const { data: signed } = await admin.storage.from("incident-photos").createSignedUrl(p.path, 3600);
    if (signed?.signedUrl) photos.push({ id: p.id, url: signed.signedUrl, caption: p.caption });
  }

  let snapshotUrl: string | null = null;
  if (report.snapshot_path) {
    const { data: s } = await admin.storage.from("incident-photos").createSignedUrl(report.snapshot_path, 3600);
    snapshotUrl = s?.signedUrl ?? null;
  }
  const notes = noteRows ?? [];

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
          title={report.log_number ? `Incident ${report.log_number}` : "Incident report"}
          subtitle={`Filed ${stamp(report.submitted_at ?? report.created_at)} by ${report.reporter_name ?? "a resident"}`}
          action={
            <div className="flex items-center gap-3">
              <Link href="/admin/incidents" className="text-sm font-medium text-pine hover:text-pine-dark">
                ← All incidents
              </Link>
              {snapshotUrl && (
                <a
                  href={snapshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
                >
                  Frozen record ↗
                </a>
              )}
              <PrintButton />
            </div>
          }
        />
      </div>

      {(original || (corrections && corrections.length > 0)) && (
        <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink print:hidden">
          {original && (
            <div>
              This is a correction to{" "}
              <Link href={`/admin/incidents/${original.id}`} className="font-medium text-pine hover:underline">
                {original.log_number ?? "the original report"}
              </Link>
              .
            </div>
          )}
          {corrections?.map((c) => (
            <div key={c.id}>
              Corrected by{" "}
              <Link href={`/admin/incidents/${c.id}`} className="font-medium text-pine hover:underline">
                {c.log_number ?? "a later report"}
              </Link>
              .
            </div>
          ))}
        </div>
      )}

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

        {/* Signed attestation + provenance — the evidentiary spine. */}
        <div className="border-t border-clay pt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Signed attestation
          </div>
          <p className="text-sm italic leading-relaxed text-ink-soft">
            &ldquo;{report.attestation_text ?? "—"}&rdquo;
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Signed (typed name)" value={report.signed_name} />
            <Field label="Signed at" value={stamp(report.signed_at)} />
          </div>
          <div className="mt-4 grid gap-4 rounded-xl bg-sand/40 p-4 sm:grid-cols-3">
            <Field label="Log number" value={report.log_number} />
            <Field label="Submitted (server)" value={stamp(report.submitted_at)} />
            <Field label="From IP" value={report.submitter_ip} />
          </div>
          {report.submitter_user_agent && (
            <div className="mt-2 text-xs text-ink-faint">Device: {report.submitter_user_agent}</div>
          )}
          {snapshotUrl && (
            <a
              href={snapshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-pine hover:underline print:hidden"
            >
              Open the frozen document of record ↗
            </a>
          )}
        </div>
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

      {/* Append-only staff note log — screen only */}
      <Card className="mt-6 p-6 print:hidden sm:p-8">
        <h2 className="mb-1 font-display text-lg font-semibold text-ink">Note log</h2>
        <p className="mb-4 text-xs text-ink-faint">
          A running record of what was done. Notes can be added but not edited or deleted.
        </p>
        {notes.length > 0 ? (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="border-l-2 border-pine/40 pl-3">
                <p className="whitespace-pre-wrap text-sm text-ink">{n.body}</p>
                <div className="mt-0.5 text-xs text-ink-faint">
                  {n.author?.full_name ?? "Staff"} · {stamp(n.created_at)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-faint">No notes yet.</p>
        )}
        <IncidentNoteForm incidentId={report.id} />
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
