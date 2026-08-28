import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/email";
import { annivInfo, anniversaryEmail } from "@/lib/anniversary";

export const dynamic = "force-dynamic";

type OccRow = {
  unit_id: string;
  occupant_profile_id: string | null;
  move_in_date: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  units: { properties: { name: string | null } | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

/**
 * Daily job (Vercel Cron) that emails a congratulations note to every resident
 * whose move-in anniversary is today. Idempotent: a resident is emailed at most
 * once per calendar year via the anniversary_emails dedupe table, so re-running
 * the job — or a manual staff send earlier the same day — never double-sends.
 *
 * Protected by CRON_SECRET: Vercel sends `Authorization: Bearer $CRON_SECRET`
 * with scheduled requests when that env var is set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient() as unknown as SupabaseClient;
  const today = new Date();
  const year = today.getFullYear();

  const { data: occ } = await db
    .from("unit_occupancy")
    .select(
      "unit_id, occupant_profile_id, move_in_date, tenant_name, tenant_email, units(properties(name)), profiles:occupant_profile_id(full_name, email)"
    )
    .not("move_in_date", "is", null)
    .returns<OccRow[]>();

  // Residents whose anniversary is today, 1+ years in, with an email on file.
  const emailOf = (o: OccRow) => o.profiles?.email?.trim() || o.tenant_email?.trim() || null;
  const keyOf = (o: OccRow) => o.occupant_profile_id ?? o.unit_id;

  const due = (occ ?? []).filter((o) => {
    if (!o.move_in_date || !emailOf(o)) return false;
    const { years, isToday } = annivInfo(o.move_in_date, today);
    return isToday && years >= 1;
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, date: today.toISOString().slice(0, 10), sent: 0 });
  }

  // Skip anyone already emailed this calendar year.
  const ids = due.map(keyOf);
  const { data: already } = await db
    .from("anniversary_emails")
    .select("resident_id")
    .eq("year", year)
    .in("resident_id", ids)
    .returns<{ resident_id: string }[]>();
  const done = new Set((already ?? []).map((r) => r.resident_id));

  let sent = 0;
  for (const o of due) {
    const residentId = keyOf(o);
    if (done.has(residentId)) continue;

    const { years } = annivInfo(o.move_in_date!, today);
    const fullName = o.profiles?.full_name ?? o.tenant_name ?? null;
    const firstName = fullName?.trim().split(/\s+/)[0] ?? "there";
    const { subject, html } = anniversaryEmail({
      firstName,
      years,
      propertyName: o.units?.properties?.name ?? null,
      moveInDate: o.move_in_date,
    });

    const { sent: ok } = await sendNotification({
      to: emailOf(o)!,
      subject,
      html,
    });

    if (ok) {
      await db
        .from("anniversary_emails")
        .upsert({ resident_id: residentId, year }, { onConflict: "resident_id,year" });
      sent += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    date: today.toISOString().slice(0, 10),
    candidates: due.length,
    sent,
  });
}
