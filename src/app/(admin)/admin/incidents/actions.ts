"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { signInLink } from "@/lib/portal-invite";
import { sendNotification } from "@/lib/email";
import { incidentRequestEmail } from "@/lib/incident-email";

export type IncidentAdminState = { ok: boolean; error?: string; sentTo?: string };

const STATUSES = new Set(["new", "reviewed", "action_taken", "closed"]);

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

/** Save the office-use fields + status on an incident report. Staff-only. */
export async function updateIncident(
  _prev: IncidentAdminState,
  form: FormData
): Promise<IncidentAdminState> {
  const { user, profile } = await requireProfile("/admin/incidents");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = str(form.get("id"));
  if (!id) return { ok: false, error: "Missing report." };

  const statusRaw = str(form.get("status")) ?? "new";
  const status = STATUSES.has(statusRaw) ? statusRaw : "new";

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const patch: Record<string, unknown> = {
    status,
    received_by: str(form.get("received_by")),
    action_taken: str(form.get("action_taken")),
    follow_up: str(form.get("follow_up")),
    attorney_notified: str(form.get("attorney_notified")),
    admin_notes: str(form.get("admin_notes")),
  };
  // Stamp the reviewer the first time it moves past "new".
  if (status !== "new") {
    patch.reviewed_by = user.id;
    patch.reviewed_at = new Date().toISOString();
  }

  const { error } = await db.from("incident_reports").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Could not save. Please try again." };

  revalidatePath(`/admin/incidents/${id}`);
  revalidatePath("/admin/incidents");
  return { ok: true };
}

/** Email a resident a one-click link to the incident form. Staff-only. */
export async function emailIncidentForm(
  _prev: IncidentAdminState,
  form: FormData
): Promise<IncidentAdminState> {
  const { profile } = await requireProfile("/admin/incidents");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const residentId = str(form.get("resident_id"));
  const note = str(form.get("note"));
  if (!residentId) return { ok: false, error: "Pick a resident." };

  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", residentId)
    .maybeSingle<{ full_name: string | null; email: string | null }>();

  const email = p?.email?.trim();
  if (!email) return { ok: false, error: "That resident has no email on file." };

  const link = await signInLink(email, "/portal/incident");
  const { subject, html } = incidentRequestEmail({
    firstName: p?.full_name?.split(" ")[0] ?? "there",
    link,
    note,
  });
  const res = await sendNotification({
    to: email,
    subject,
    html,
    meta: { kind: "incident_form_request", refType: "profile", refId: residentId },
  });
  if (!res.sent) return { ok: false, error: "Could not send the email. Please try again." };

  return { ok: true, sentTo: email };
}

/** Add a staff note to an incident's append-only note log. */
export async function addIncidentNote(
  _prev: IncidentAdminState,
  form: FormData
): Promise<IncidentAdminState> {
  const { user, profile } = await requireProfile("/admin/incidents");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const incidentId = str(form.get("incident_id"));
  const body = str(form.get("body"));
  if (!incidentId) return { ok: false, error: "Missing report." };
  if (!body) return { ok: false, error: "Write a note first." };

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db.from("incident_notes").insert({
    incident_id: incidentId,
    author_id: user.id,
    body,
  });
  if (error) return { ok: false, error: "Could not add the note." };

  revalidatePath(`/admin/incidents/${incidentId}`);
  return { ok: true };
}
