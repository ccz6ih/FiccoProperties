"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification } from "@/lib/email";
import { annivInfo, anniversaryEmail } from "@/lib/anniversary";

type SendRow = {
  move_in_date: string | null;
  units: { properties: { name: string | null } | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

/**
 * Manually send (or re-send) the anniversary congrats email to one resident.
 * Recomputes the year count server-side and records the send so the daily cron
 * won't also email them this year.
 */
export async function sendAnniversaryCongrats(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/anniversaries");
  if (!isStaff(profile)) return;

  const residentId = (form.get("resident_id") as string)?.trim();
  if (!residentId) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select(
      "move_in_date, units(properties(name)), profiles:occupant_profile_id(full_name, email)"
    )
    .eq("occupant_profile_id", residentId)
    .maybeSingle<SendRow>();

  const email = occ?.profiles?.email;
  if (!occ?.move_in_date || !email) return;

  const today = new Date();
  const { years } = annivInfo(occ.move_in_date, today);
  if (years < 1) return;

  const firstName = occ.profiles?.full_name?.split(" ")[0] ?? "there";
  const { subject, html } = anniversaryEmail({
    firstName,
    years,
    propertyName: occ.units?.properties?.name ?? null,
  });

  const { sent } = await sendNotification({
    to: email,
    subject,
    html,
    replyTo: "hello@38thaveproperties.com",
  });

  if (sent) {
    await db
      .from("anniversary_emails")
      .upsert(
        { resident_id: residentId, year: today.getFullYear() },
        { onConflict: "resident_id,year" }
      );
  }

  revalidatePath("/admin/anniversaries");
}
