"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { sendNotification } from "@/lib/email";
import { incidentAlertEmail, incidentReceiptEmail } from "@/lib/incident-email";

export type IncidentState = { ok: boolean; error?: string };

const INCIDENT_BUCKET = "incident-photos";
const FILE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf",
]);
const MAX_PHOTOS = 10;

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

  // Resolve the reporter's home + contact snapshot.
  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;
  const unitId = await getResidentUnitId(user.id);

  const { data: profile } = await db
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; email: string | null; phone: string | null }>();

  let home = "—";
  if (unitId) {
    const { data: unit } = await db
      .from("units")
      .select("label, properties(name)")
      .eq("id", unitId)
      .maybeSingle<{ label: string; properties: { name: string | null } | null }>();
    if (unit) home = `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`;
  }

  const reporterName = str(form, "reporter_name") ?? profile?.full_name ?? user.email ?? "A resident";
  const reporterEmail = profile?.email ?? user.email ?? null;

  const { data: inserted, error } = await db
    .from("incident_reports")
    .insert({
      reporter_id: user.id,
      unit_id: unitId,
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
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !inserted) return { ok: false, error: "Could not submit your report. Please try again." };
  const reportId = inserted.id;

  // Upload any photos (best-effort; a failed photo shouldn't lose the report).
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  let photoCount = 0;
  for (const file of files.slice(0, MAX_PHOTOS)) {
    if (!FILE_TYPES.has(file.type)) continue;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${reportId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(INCIDENT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) continue;
    await db.from("incident_report_photos").insert({
      report_id: reportId,
      path,
      created_by: user.id,
    });
    photoCount++;
  }

  // Human date/time for the emails.
  const occurred = [str(form, "occurred_on"), str(form, "occurred_time")]
    .filter(Boolean)
    .join(" · ") || "Not specified";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://38thaveproperties.com").replace(/\/$/, "");
  const emailData = {
    id: reportId,
    reporterName,
    home,
    occurred,
    location: str(form, "location") ?? "",
    narrative,
    anyoneHurt: str(form, "anyone_hurt") === "yes",
    policeCalled: str(form, "police_called") ?? "no",
    photoCount,
    appUrl,
  };

  // Alert staff/owners (reply-to the reporter), and copy the reporter.
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
