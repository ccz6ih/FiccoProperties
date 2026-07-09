"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification, esc } from "@/lib/email";

const NOTICE_TYPES = [
  "late_rent",
  "pay_or_quit",
  "lease_violation",
  "entry",
  "general",
];
const SERVED_METHODS = ["posted", "mailed", "hand", "email", "portal"];
const NOTICE_STATUSES = ["draft", "served", "cured", "expired", "withdrawn"];

// database.ts is regenerated centrally and may not yet know the notices table.
// Use a loose handle for writes to avoid build breaks.
function loose(supabase: Awaited<ReturnType<typeof createClient>>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Create a draft notice. Staff only. Redirects to the new notice. */
export async function createNotice(form: FormData) {
  const { profile } = await requireProfile("/admin/notices/new");
  if (!isStaff(profile)) return;

  const resident_id = (form.get("resident_id") as string)?.trim();
  const type = (form.get("type") as string)?.trim();
  const title = (form.get("title") as string)?.trim();
  const body = (form.get("body") as string)?.trim();
  const amountRaw = (form.get("amount") as string)?.trim();
  const cure_by = (form.get("cure_by") as string)?.trim();

  if (!resident_id || !type || !NOTICE_TYPES.includes(type)) return;
  if (!title || !body) return;

  const supabase = await createClient();

  // Pull the resident's current unit from their occupancy, if any.
  const { data: occupancy } = await supabase
    .from("unit_occupancy")
    .select("unit_id")
    .eq("occupant_profile_id", resident_id)
    .maybeSingle<{ unit_id: string | null }>();

  const amountDollars = amountRaw ? parseFloat(amountRaw) : NaN;
  const amount_cents =
    !Number.isNaN(amountDollars) && amountDollars >= 0
      ? Math.round(amountDollars * 100)
      : null;

  const db = loose(supabase);
  const { data: notice, error } = await db
    .from("notices")
    .insert({
      resident_id,
      unit_id: occupancy?.unit_id ?? null,
      type,
      title,
      body,
      amount_cents,
      cure_by: cure_by || null,
      status: "draft",
      created_by: profile!.id,
    })
    .select("id")
    .single();

  if (error || !notice) return;

  revalidatePath("/admin/notices");
  redirect(`/admin/notices/${notice.id}`);
}

/** Record service: stamps served_at + served_method and sets status 'served'. */
export async function setNoticeServed(form: FormData) {
  const { profile } = await requireProfile("/admin/notices");
  if (!isStaff(profile)) return;

  const id = (form.get("id") as string)?.trim();
  const served_at = (form.get("served_at") as string)?.trim();
  const served_method = (form.get("served_method") as string)?.trim();
  if (!id || !served_at || !served_method || !SERVED_METHODS.includes(served_method))
    return;

  const supabase = await createClient();
  const db = loose(supabase);
  await db
    .from("notices")
    .update({ served_at, served_method, status: "served" })
    .eq("id", id);

  // Email a copy to the resident (or the tenancy email on the unit) if we have
  // one, and record the address it went to so staff can confirm delivery.
  let emailedTo: string | null = null;
  try {
    const admin = createAdminClient() as unknown as SupabaseClient;
    const { data: n } = await admin
      .from("notices")
      .select("title, body, resident_id, unit_id")
      .eq("id", id)
      .maybeSingle<{ title: string; body: string; resident_id: string | null; unit_id: string | null }>();

    let email: string | null = null;
    if (n?.resident_id) {
      const { data: p } = await admin
        .from("profiles")
        .select("email")
        .eq("id", n.resident_id)
        .maybeSingle<{ email: string | null }>();
      email = p?.email ?? null;
    }
    if (!email && n?.unit_id) {
      const { data: o } = await admin
        .from("unit_occupancy")
        .select("tenant_email")
        .eq("unit_id", n.unit_id)
        .maybeSingle<{ tenant_email: string | null }>();
      email = o?.tenant_email ?? null;
    }
    if (email && n) {
      const { sent } = await sendNotification({
        to: email,
        replyTo: "hello@38thaveproperties.com",
        subject: n.title,
        html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;color:#2c2622"><div style="font-family:Georgia,serif;font-size:18px;color:#2f5d50;margin-bottom:6px">38th Ave Properties</div><pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:13px;line-height:1.6;color:#2c2622;background:#faf7f1;border:1px solid #e6dcc8;border-radius:8px;padding:14px">${esc(n.body)}</pre><p style="font-size:12px;color:#9b9286;margin-top:12px">This notice is also available in your resident portal.</p></div>`,
      });
      if (sent) emailedTo = email;
    }
  } catch {
    // emailing is best-effort; serving still succeeds
  }

  await db.from("notices").update({ served_email: emailedTo }).eq("id", id);

  revalidatePath("/admin/notices");
  revalidatePath(`/admin/notices/${id}`);
  revalidatePath("/portal/notices");
}

/** Update a notice's status (cured / expired / withdrawn / etc.). */
export async function setNoticeStatus(form: FormData) {
  const { profile } = await requireProfile("/admin/notices");
  if (!isStaff(profile)) return;

  const id = (form.get("id") as string)?.trim();
  const status = (form.get("status") as string)?.trim();
  if (!id || !status || !NOTICE_STATUSES.includes(status)) return;

  const supabase = await createClient();
  await loose(supabase).from("notices").update({ status }).eq("id", id);

  revalidatePath("/admin/notices");
  revalidatePath(`/admin/notices/${id}`);
  revalidatePath("/portal/notices");
}
