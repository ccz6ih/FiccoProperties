"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { sendNotification } from "@/lib/email";
import { incidentAlertEmail, incidentReceiptEmail } from "@/lib/incident-email";
import { renderIncidentSnapshot } from "@/lib/incident-snapshot";

export type IncidentState = { ok: boolean; error?: string };

const INCIDENT_BUCKET = "incident-photos";
const FILE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf",
]);
const MAX_PHOTOS = 10;

/** The exact wording the resident attests to — snapshotted on every report so a
 * later reword never changes what a past filer agreed to. */
export const ATTESTATION_TEXT =
  "Everything I wrote above is true and correct as far as I know. I understand this report may be kept on file and may be used if this matter goes to court.";

function str(form: FormData, key: string): string | null {
  const v = (form.get(key) as string | null)?.trim();
  return v || null;
}

export async function submitIncidentReport(
  _prev: IncidentState,
  form: FormData
): Promise<IncidentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const narrative = str(form, "narrative");
  if (!narrative) return { ok: false, error: "Please describe what happened." };

  const signedName = str(form, "signed_name");
  if (!signedName) return { ok: false, error: "Type your full name to sign the report." };
  if (form.get("attest") !== "on") {
    return { ok: false, error: "Please check the box to confirm your report is true." };
  }

  // Server-set provenance — never trust the client for these.
  const h = await headers();
  const submitterIp =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const submitterUserAgent = h.get("user-agent") || null;
  const nowIso = new Date().toISOString();

  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;
  const unitId = await getResidentUnitId(user.id);

  const { data: profile } = await db
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; email: string | null; phone: string | null }>();

  let home = "—";
  let propertyId: string | null = null;
  if (unitId) {
    const { data: unit } = await db
      .from("units")
      .select("label, property_id, properties(name)")
      .eq("id", unitId)
      .maybeSingle<{ label: string; property_id: string | null; properties: { name: string | null } | null }>();
    if (unit) {
      home = `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`;
      propertyId = unit.property_id ?? null;
    }
  }

  // Correction/addendum linkage (optional).
  const supersedesId = str(form, "corrects_id");
  let correctionOf: string | null = null;
  if (supersedesId) {
    const { data: orig } = await db
      .from("incident_reports")
      .select("log_number, reporter_id")
      .eq("id", supersedesId)
      .maybeSingle<{ log_number: string | null; reporter_id: string | null }>();
    // Only honor a correction that links to the resident's own earlier report.
    if (orig?.reporter_id === user.id) correctionOf = orig.log_number ?? null;
  }

  const reporterName = signedName || profile?.full_name || user.email || "A resident";
  const reporterEmail = profile?.email ?? user.email ?? null;

  const { data: inserted, error } = await db
    .from("incident_reports")
    .insert({
      reporter_id: user.id,
      unit_id: unitId,
      property_id: propertyId,
      reporter_name: reporterName,
      reporter_phone: str(form, "reporter_phone") ?? profile?.phone ?? null,
      reporter_email: reporterEmail,
      occurred_on: str(form, "occurred_on"),
      occurred_time: str(form, "occurred_time"),
      location: str(form, "location"),
      involved: str(form, "involved"),
      narrative,
      anyone_hurt: str(form, "anyone_hurt"),
      hurt_details: str(form, "hurt_details"),
      police_called: str(form, "police_called"),
      police_ref: str(form, "police_ref"),
      has_evidence: form.get("has_evidence") === "on",
      happened_before: str(form, "happened_before"),
      before_when: str(form, "before_when"),
      additional: str(form, "additional"),
      // e-signature + provenance (server-set)
      attestation_text: ATTESTATION_TEXT,
      signed_name: signedName,
      signed_at: nowIso,
      submitted_at: nowIso,
      submitter_ip: submitterIp,
      submitter_user_agent: submitterUserAgent,
      supersedes_id: correctionOf ? supersedesId : null,
    })
    .select("id, log_number")
    .maybeSingle<{ id: string; log_number: string | null }>();

  if (error || !inserted) return { ok: false, error: "Could not submit your report. Please try again." };
  const reportId = inserted.id;
  const logNumber = inserted.log_number ?? reportId.slice(0, 8);

  // Upload photos (best-effort; a failed photo shouldn't lose the report).
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const photoNames: string[] = [];
  for (const file of files.slice(0, MAX_PHOTOS)) {
    if (!FILE_TYPES.has(file.type)) continue;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${reportId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(INCIDENT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) continue;
    await db.from("incident_report_photos").insert({ report_id: reportId, path, created_by: user.id });
    photoNames.push(file.name);
  }

  // Freeze the document snapshot and store it privately.
  const occurred =
    [str(form, "occurred_on"), str(form, "occurred_time")].filter(Boolean).join(" · ") || "Not specified";
  const snapshotHtml = renderIncidentSnapshot({
    logNumber,
    submittedAt: nowIso,
    reporterName,
    home,
    reporterPhone: str(form, "reporter_phone") ?? profile?.phone ?? null,
    reporterEmail,
    occurred,
    location: str(form, "location"),
    involved: str(form, "involved"),
    narrative,
    anyoneHurt: str(form, "anyone_hurt"),
    hurtDetails: str(form, "hurt_details"),
    policeCalled: str(form, "police_called"),
    policeRef: str(form, "police_ref"),
    hasEvidence: form.get("has_evidence") === "on",
    happenedBefore: str(form, "happened_before"),
    beforeWhen: str(form, "before_when"),
    additional: str(form, "additional"),
    photoNames,
    attestationText: ATTESTATION_TEXT,
    signedName,
    signedAt: nowIso,
    submitterIp,
    submitterUserAgent,
    correctionOf,
  });
  const snapshotPath = `${reportId}/snapshot.html`;
  const { error: snapErr } = await admin.storage
    .from(INCIDENT_BUCKET)
    .upload(snapshotPath, new Blob([snapshotHtml], { type: "text/html" }), {
      contentType: "text/html",
      upsert: true,
    });
  if (!snapErr) {
    await db.from("incident_reports").update({ snapshot_path: snapshotPath }).eq("id", reportId);
  }

  // Emails — staff/owner alert (reply-to the reporter) + resident acknowledgment.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://38thaveproperties.com").replace(/\/$/, "");
  const emailData = {
    id: reportId,
    logNumber,
    reporterName,
    home,
    occurred,
    location: str(form, "location") ?? "",
    narrative,
    anyoneHurt: str(form, "anyone_hurt") === "yes",
    policeCalled: str(form, "police_called") ?? "no",
    photoCount: photoNames.length,
    appUrl,
  };
  const alert = incidentAlertEmail(emailData);
  await sendNotification({
    subject: alert.subject,
    html: alert.html,
    replyTo: reporterEmail ?? undefined,
    meta: { kind: "incident_report", refType: "incident", refId: reportId },
  });
  if (reporterEmail) {
    const copy = incidentReceiptEmail(emailData);
    await sendNotification({ to: reporterEmail, subject: copy.subject, html: copy.html });
  }

  revalidatePath("/portal/incident");
  revalidatePath("/admin/incidents");
  return { ok: true };
}
