"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification } from "@/lib/email";
import { communityNoteEmail } from "@/lib/community-email";

export type AnnouncementState = { ok: boolean; error?: string; notice?: string };

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://38thaveproperties.com").replace(/\/$/, "");

/** Post an announcement; optionally email everyone it targets. */
export async function createAnnouncement(
  _prev: AnnouncementState,
  form: FormData
): Promise<AnnouncementState> {
  const { user, profile } = await requireProfile("/admin/announcements");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const title = (form.get("title") as string)?.trim();
  const body = (form.get("body") as string)?.trim();
  if (!title) return { ok: false, error: "Give it a title." };
  if (!body) return { ok: false, error: "Write the announcement." };

  const propertyIds = form
    .getAll("property_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const expiresOn = ((form.get("expires_on") as string) || "").trim() || null;
  const emailToo = form.get("email_residents") === "on";

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { data: inserted, error } = await db
    .from("announcements")
    .insert({
      title,
      body,
      property_ids: propertyIds.length > 0 ? propertyIds : null,
      expires_on: expiresOn,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !inserted) return { ok: false, error: "Could not post the announcement." };

  let emailed = 0;
  if (emailToo) {
    // Everyone living in a targeted community with an email on file: linked
    // portal accounts (occupancy + co-tenants) plus record-only tenant emails.
    const admin = createAdminClient() as unknown as SupabaseClient;
    const targets = new Set(propertyIds);
    const { data: occ } = await admin
      .from("unit_occupancy")
      .select("unit_id, occupant_profile_id, tenant_email, tenant_name, units(property_id)")
      .returns<{
        unit_id: string;
        occupant_profile_id: string | null;
        tenant_email: string | null;
        tenant_name: string | null;
        units: { property_id: string | null } | null;
      }[]>();
    const inScope = (occ ?? []).filter(
      (o) => targets.size === 0 || (o.units?.property_id && targets.has(o.units.property_id))
    );

    const unitIds = inScope.map((o) => o.unit_id);
    const { data: members } = unitIds.length
      ? await admin
          .from("unit_occupants")
          .select("unit_id, profiles:profile_id(full_name, email)")
          .in("unit_id", unitIds)
          .returns<{ unit_id: string; profiles: { full_name: string | null; email: string | null } | null }[]>()
      : { data: [] as { unit_id: string; profiles: { full_name: string | null; email: string | null } | null }[] };

    const profileIds = inScope.map((o) => o.occupant_profile_id).filter((v): v is string => !!v);
    const { data: linked } = profileIds.length
      ? await admin
          .from("profiles")
          .select("full_name, email")
          .in("id", profileIds)
          .returns<{ full_name: string | null; email: string | null }[]>()
      : { data: [] as { full_name: string | null; email: string | null }[] };

    const recipients = new Map<string, string>(); // email -> first name
    const firstName = (n: string | null) => n?.trim().split(/\s+/)[0] || "there";
    for (const p of linked ?? []) if (p.email) recipients.set(p.email.toLowerCase(), firstName(p.full_name));
    for (const m of members ?? [])
      if (m.profiles?.email) recipients.set(m.profiles.email.toLowerCase(), firstName(m.profiles.full_name));
    for (const o of inScope)
      if (o.tenant_email && !recipients.has(o.tenant_email.toLowerCase()))
        recipients.set(o.tenant_email.toLowerCase(), firstName(o.tenant_name));

    for (const [email, name] of recipients) {
      const html = communityNoteEmail({ firstName: name, heading: title, body, appUrl: APP_URL });
      const res = await sendNotification({ to: email, subject: `📣 ${title}`, html });
      if (res.sent) emailed++;
    }
  }

  revalidatePath("/admin/announcements");
  revalidatePath("/portal");
  return {
    ok: true,
    notice: emailToo ? `Posted — and emailed ${emailed} resident${emailed === 1 ? "" : "s"}.` : "Posted to the portal.",
  };
}

/** Take an announcement down. */
export async function deleteAnnouncement(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/announcements");
  if (!isStaff(profile)) return;
  const id = (form.get("id") as string)?.trim();
  if (!id) return;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("announcements").delete().eq("id", id);
  revalidatePath("/admin/announcements");
  revalidatePath("/portal");
}
