/**
 * Repayment-plan e-signature helpers. The tenant signs from the portal (typed
 * name + attestation, IP/UA captured), the landlord countersigns in admin —
 * and the moment both have signed, each side gets the fully executed copy.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification, esc } from "@/lib/email";
import { formatCents, formatDate } from "@/lib/format";

/** Snapshotted onto the record at signing — a reword never changes past signings. */
export const TENANT_ATTESTATION =
  "I have read this Rent Repayment Agreement and agree to the payment schedule and terms above. I understand these payments are for past-due rent only, that my regular rent remains due as usual, and that this signature is legally binding.";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const LINE = "#e6dcc8";

export type PlanForEmail = {
  id: string;
  unit_id: string | null;
  total_cents: number;
  down_payment_cents: number;
  installments: number;
  cadence: string;
  notes: string | null;
  tenant_signed_name: string | null;
  tenant_signed_at: string | null;
  tenant_signed_ip: string | null;
  landlord_signed_name: string | null;
  landlord_signed_at: string | null;
  executed_email_sent_at: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

const stamp = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })
    : "—";

/**
 * If BOTH signatures are on the plan and the executed copy hasn't gone out yet,
 * email it to the tenant and the office, and mark it sent. Safe to call after
 * either party signs.
 */
export async function maybeSendExecutedCopies(planId: string): Promise<void> {
  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: plan } = await db
    .from("repayment_plans")
    .select(
      "id, unit_id, total_cents, down_payment_cents, installments, cadence, notes, tenant_signed_name, tenant_signed_at, tenant_signed_ip, landlord_signed_name, landlord_signed_at, executed_email_sent_at, units:unit_id(label, properties(name))"
    )
    .eq("id", planId)
    .maybeSingle<PlanForEmail>();
  if (!plan?.tenant_signed_at || !plan.landlord_signed_at || plan.executed_email_sent_at) return;

  const { data: items } = await db
    .from("repayment_plan_items")
    .select("seq, due_date, amount_cents, status")
    .eq("plan_id", planId)
    .order("seq", { ascending: true })
    .returns<{ seq: number; due_date: string; amount_cents: number; status: string }[]>();

  // Tenant email — occupancy fetched directly (nested embeds come back empty).
  let email: string | null = null;
  let tenantName = plan.tenant_signed_name ?? "Resident";
  if (plan.unit_id) {
    const { data: occ } = await db
      .from("unit_occupancy")
      .select("tenant_name, tenant_email, occupant_profile_id")
      .eq("unit_id", plan.unit_id)
      .maybeSingle<{ tenant_name: string | null; tenant_email: string | null; occupant_profile_id: string | null }>();
    email = occ?.tenant_email?.trim() || null;
    tenantName = plan.tenant_signed_name ?? occ?.tenant_name ?? "Resident";
    if (occ?.occupant_profile_id) {
      const { data: p } = await db
        .from("profiles").select("email").eq("id", occ.occupant_profile_id)
        .maybeSingle<{ email: string | null }>();
      if (p?.email) email = p.email;
    }
  }

  const home = `${plan.units?.properties?.name ? `${plan.units.properties.name} · ` : ""}${plan.units?.label ?? ""}`;
  const rows = (items ?? [])
    .map(
      (r) =>
        `<tr><td style="padding:7px 10px;border-bottom:1px solid ${LINE};color:${FAINT};font-size:13px">${r.seq}</td><td style="padding:7px 10px;border-bottom:1px solid ${LINE};color:${INK};font-size:14px">${formatDate(r.due_date)}</td><td style="padding:7px 10px;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;font-weight:600;text-align:right">${formatCents(r.amount_cents)}</td></tr>`
    )
    .join("");
  const sig = (who: string, name: string | null, at: string | null, extra?: string) =>
    `<td style="border:1px solid ${LINE};background:#faf7f1;padding:12px 16px;vertical-align:top"><div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em">${who}</div><div style="font-family:Georgia,serif;font-size:17px;font-style:italic;color:${INK};margin-top:3px">${esc(name ?? "—")}</div><div style="font-size:12px;color:${FAINT};margin-top:2px">Signed ${esc(stamp(at))}${extra ? ` · ${esc(extra)}` : ""}</div></td>`;

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center"><table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${PINE};padding:22px 28px"><div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div><div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Fully executed · Rent repayment agreement</div></td></tr>
    <tr><td style="padding:26px 28px 8px">
      <div style="font-family:Georgia,serif;font-size:21px;color:${INK};margin-bottom:8px">Signed by both parties ✓</div>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:${INK}">The repayment agreement for <strong>${esc(home)}</strong> is now fully executed. This email is the official copy for both parties' records.</p>
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:16px"><tr>${sig("Tenant", plan.tenant_signed_name, plan.tenant_signed_at, plan.tenant_signed_ip ? `from ${plan.tenant_signed_ip}` : undefined)}${sig("Landlord — 38th Ave Properties", plan.landlord_signed_name, plan.landlord_signed_at)}</tr></table>
      <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Agreed schedule — ${formatCents(plan.total_cents - plan.down_payment_cents)} after a ${formatCents(plan.down_payment_cents)} down payment</div>
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:14px">${rows}</table>
      ${plan.notes ? `<p style="margin:0 0 12px;font-size:13px;color:${FAINT}">Note: ${esc(plan.notes)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:8px 28px 26px"><div style="border-top:1px solid #f0e9db;padding-top:14px"><p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">Signed electronically under the Colorado Uniform Electronic Transactions Act. Keep this email for your records.</p></div></td></tr>
  </table></td></tr></table></div>`;

  const subject = `Fully executed — rent repayment agreement · ${home}`;
  if (email) {
    await sendNotification({
      to: email, subject, html,
      meta: { kind: "repayment_executed", refType: "repayment_plan", refId: plan.id },
    });
  }
  // Office copy to the staff inbox.
  await sendNotification({ subject: `${subject} (${tenantName})`, html });

  await db
    .from("repayment_plans")
    .update({ executed_email_sent_at: new Date().toISOString() })
    .eq("id", planId);
}
