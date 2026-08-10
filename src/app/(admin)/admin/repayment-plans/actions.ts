"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { buildSchedule, type Cadence } from "@/lib/repayment";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification, esc } from "@/lib/email";
import { formatCents, formatDate } from "@/lib/format";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";
import type { EmailActionState } from "@/lib/action-state";
import { maybeSendExecutedCopies } from "@/lib/repayment-esign";

const CADENCES: Cadence[] = ["weekly", "biweekly", "monthly"];

/** Create a repayment plan for a unit's outstanding balance + its schedule. */
export async function createRepaymentPlan(form: FormData) {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const totalDollars = Number(form.get("total_dollars"));
  const downDollars = Number(form.get("down_dollars")) || 0;
  const installments = Math.max(1, Math.floor(Number(form.get("installments")) || 1));
  const cadenceRaw = (form.get("cadence") as string)?.trim() as Cadence;
  const cadence: Cadence = CADENCES.includes(cadenceRaw) ? cadenceRaw : "monthly";
  const startDate = (form.get("start_date") as string)?.trim();
  const notes = (form.get("notes") as string)?.trim() || null;

  if (!unitId || !startDate) return;
  if (!Number.isFinite(totalDollars) || totalDollars <= 0) return;

  const totalCents = Math.round(totalDollars * 100);
  const downCents = Math.max(0, Math.round(downDollars * 100));

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select("occupant_profile_id")
    .eq("unit_id", unitId)
    .maybeSingle<{ occupant_profile_id: string | null }>();

  const { data: plan, error } = await db
    .from("repayment_plans")
    .insert({
      unit_id: unitId,
      resident_id: occ?.occupant_profile_id ?? null,
      total_cents: totalCents,
      down_payment_cents: downCents,
      installments,
      cadence,
      start_date: startDate,
      status: "active",
      notes,
      created_by: profile!.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !plan) return;

  const schedule = buildSchedule({
    totalCents,
    downPaymentCents: downCents,
    installments,
    cadence,
    startDate,
  });
  await db.from("repayment_plan_items").insert(
    schedule.map((s) => ({
      plan_id: plan.id,
      seq: s.seq,
      due_date: s.dueDate,
      amount_cents: s.amountCents,
      status: "open",
    }))
  );

  revalidatePath("/admin/repayment-plans");
  redirect(`/admin/repayment-plans/${plan.id}`);
}

/** Toggle an installment paid/open (tracking only — record the actual money on Payments). */
export async function toggleInstallment(form: FormData) {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) return;

  const itemId = (form.get("item_id") as string)?.trim();
  const planId = (form.get("plan_id") as string)?.trim();
  const paid = (form.get("paid") as string) === "1";
  if (!itemId || !planId) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  await db
    .from("repayment_plan_items")
    .update({ status: paid ? "paid" : "open", paid_at: paid ? new Date().toISOString() : null })
    .eq("id", itemId);

  // Auto-complete the plan when every installment is paid.
  const { data: items } = await db
    .from("repayment_plan_items")
    .select("status")
    .eq("plan_id", planId)
    .returns<{ status: string }[]>();
  const allPaid = (items ?? []).length > 0 && (items ?? []).every((i) => i.status === "paid");
  await db
    .from("repayment_plans")
    .update({ status: allPaid ? "completed" : "active" })
    .eq("id", planId);

  revalidatePath(`/admin/repayment-plans/${planId}`);
  revalidatePath("/admin/repayment-plans");
}

/** Cancel or reactivate a plan. */
export async function setPlanStatus(form: FormData) {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) return;

  const planId = (form.get("plan_id") as string)?.trim();
  const status = (form.get("status") as string)?.trim();
  if (!planId || !["active", "cancelled", "completed"].includes(status)) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("repayment_plans").update({ status }).eq("id", planId);

  revalidatePath(`/admin/repayment-plans/${planId}`);
  revalidatePath("/admin/repayment-plans");
}

/**
 * Email the repayment agreement to the tenant — schedule, terms, and where to
 * pay. Recipient: the unit's portal account email, else the tenancy email.
 */
export async function emailRepaymentPlan(
  _prev: EmailActionState,
  form: FormData
): Promise<EmailActionState> {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const planId = (form.get("plan_id") as string)?.trim();
  if (!planId) return { ok: false, error: "Missing plan." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const [{ data: plan }, { data: items }] = await Promise.all([
    db
      .from("repayment_plans")
      .select(
        "id, unit_id, total_cents, down_payment_cents, installments, cadence, status, notes, units:unit_id(label, properties(name, address_line1, city, state))"
      )
      .eq("id", planId)
      .maybeSingle<{
        id: string;
        unit_id: string | null;
        total_cents: number;
        down_payment_cents: number;
        installments: number;
        cadence: string;
        status: string;
        notes: string | null;
        units: {
          label: string;
          properties: { name: string | null; address_line1: string | null; city: string | null; state: string | null } | null;
        } | null;
      }>(),
    db
      .from("repayment_plan_items")
      .select("seq, due_date, amount_cents, status")
      .eq("plan_id", planId)
      .order("seq", { ascending: true })
      .returns<{ seq: number; due_date: string; amount_cents: number; status: string }[]>(),
  ]);
  if (!plan) return { ok: false, error: "Plan not found." };

  // Occupancy fetched separately — the nested embed under units comes back empty.
  const { data: occ } = plan.unit_id
    ? await db
        .from("unit_occupancy")
        .select("tenant_name, tenant_email, occupant_profile_id")
        .eq("unit_id", plan.unit_id)
        .maybeSingle<{ tenant_name: string | null; tenant_email: string | null; occupant_profile_id: string | null }>()
    : { data: null };
  let email = occ?.tenant_email?.trim() || null;
  if (occ?.occupant_profile_id) {
    const { data: p } = await db
      .from("profiles")
      .select("email")
      .eq("id", occ.occupant_profile_id)
      .maybeSingle<{ email: string | null }>();
    if (p?.email) email = p.email;
  }
  if (!email) return { ok: false, error: "No email on file for this tenant." };

  const PINE = "#2f5d50", INK = "#2c2622", FAINT = "#9b9286", LINE = "#e6dcc8", TERRA = "#b4562f";
  const home = `${plan.units?.properties?.name ? `${plan.units.properties.name} · ` : ""}${plan.units?.label ?? ""}`;
  const address = [plan.units?.properties?.address_line1, plan.units?.label, plan.units?.properties?.city, plan.units?.properties?.state]
    .filter(Boolean)
    .join(", ");
  const financed = plan.total_cents - plan.down_payment_cents;
  const cadence = plan.cadence === "weekly" ? "Weekly" : plan.cadence === "biweekly" ? "Every two weeks" : "Monthly";
  const tile = (l: string, v: string) =>
    `<td style="border:1px solid ${LINE};background:#faf7f1;padding:12px 8px;text-align:center"><div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em">${l}</div><div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:${INK};margin-top:3px">${v}</div></td>`;
  const rows = (items ?? [])
    .map(
      (r) =>
        `<tr><td style="padding:8px 10px;border-bottom:1px solid ${LINE};color:${FAINT};font-size:13px">${r.seq}</td><td style="padding:8px 10px;border-bottom:1px solid ${LINE};color:${INK};font-size:14px">${formatDate(r.due_date)}</td><td style="padding:8px 10px;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;font-weight:600;text-align:right">${formatCents(r.amount_cents)}</td><td style="padding:8px 10px;border-bottom:1px solid ${LINE};font-size:13px;color:${r.status === "paid" ? PINE : TERRA};text-align:right">${r.status === "paid" ? "Paid ✓" : "Open"}</td></tr>`
    )
    .join("");

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center"><table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${PINE};padding:22px 28px"><div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div><div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Rent repayment agreement</div></td></tr>
    <tr><td style="padding:26px 28px 8px">
      <div style="font-family:Georgia,serif;font-size:21px;color:${INK};margin-bottom:8px">Your repayment plan${occ?.tenant_name ? `, ${esc(occ.tenant_name)}` : ""}</div>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:${INK}">Here is your copy of the repayment agreement for <strong>${esc(address || home)}</strong>. Keep it for your records — the schedule below is what we've agreed to.</p>
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:18px"><tr>${tile("Past-due balance", formatCents(plan.total_cents))}${tile("Down payment", formatCents(plan.down_payment_cents))}${tile("Remaining", formatCents(financed))}${tile("Schedule", `${plan.installments} · ${cadence}`)}</tr></table>
      <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Payment schedule</div>
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:18px"><thead><tr style="text-align:left;color:${FAINT};font-size:11px;text-transform:uppercase"><th style="padding:6px 10px">#</th><th style="padding:6px 10px">Due date</th><th style="padding:6px 10px;text-align:right">Amount</th><th style="padding:6px 10px;text-align:right">Status</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="background:#faf7f1;border:1px solid ${LINE};border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;line-height:1.6;color:${INK}">
        <strong>The important parts:</strong><br/>
        • These payments cover <strong>past-due rent only</strong> — your regular monthly rent is still due in full on its normal date.<br/>
        • Pay by check or money order made payable to <strong>${RENT_DROPBOX.payee}</strong>, in the drop box at ${RENT_DROPBOX.full} (write your unit number on it).<br/>
        • If a scheduled payment is missed, this agreement may be declared void and the full remaining balance pursued as allowed by law.<br/>
        • This agreement doesn't waive your rights under Colorado law, including any right to mediation.
      </div>
      ${plan.notes ? `<p style="margin:0 0 14px;font-size:13px;color:${FAINT}">Note: ${esc(plan.notes)}</p>` : ""}
      <a href="https://38thaveproperties.com/portal/repayment" style="display:inline-block;background:${PINE};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;margin-bottom:8px">Review &amp; sign online →</a>
    </td></tr>
    <tr><td style="padding:8px 28px 26px"><div style="border-top:1px solid #f0e9db;padding-top:14px"><p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">Questions or something changes? Reply to this email or call ${RENT_DROPBOX.phone} — we'd rather adjust the plan than see it break.</p></div></td></tr>
  </table></td></tr></table></div>`;

  const res = await sendNotification({
    to: email,
    subject: `Your rent repayment agreement — ${home}`,
    html,
    meta: { kind: "repayment_plan", refType: "repayment_plan", refId: plan.id },
  });
  if (!res.sent) return { ok: false, error: "Could not send. Please try again." };
  return { ok: true, sentTo: email };
}

/** Landlord countersigns the agreement (typed name, timestamped). */
export async function signRepaymentPlanAsLandlord(
  _prev: EmailActionState,
  form: FormData
): Promise<EmailActionState> {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const planId = (form.get("plan_id") as string)?.trim();
  const signedName = (form.get("signed_name") as string)?.trim();
  if (!planId) return { ok: false, error: "Missing plan." };
  if (!signedName) return { ok: false, error: "Type your name to sign." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: plan } = await db
    .from("repayment_plans")
    .select("id, status, landlord_signed_at")
    .eq("id", planId)
    .maybeSingle<{ id: string; status: string; landlord_signed_at: string | null }>();
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "cancelled") return { ok: false, error: "This plan is cancelled." };
  if (plan.landlord_signed_at) return { ok: false, error: "Already countersigned." };

  const { error } = await db
    .from("repayment_plans")
    .update({ landlord_signed_name: signedName, landlord_signed_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) return { ok: false, error: "Could not record the signature." };

  // If the tenant already signed, both sides get the executed copy now.
  await maybeSendExecutedCopies(planId);

  revalidatePath(`/admin/repayment-plans/${planId}`);
  revalidatePath("/portal/repayment");
  return { ok: true, sentTo: signedName };
}
