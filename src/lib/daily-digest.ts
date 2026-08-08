/**
 * Owner morning digest — one email, every morning, that makes the whole
 * portfolio visible without opening the portal: what happened in the last
 * day, and what needs attention today. Built big-type and plain-English for
 * easy reading.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/format";
import { esc } from "@/lib/email";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const TERRA = "#b4562f";
const LINE = "#e6dcc8";
const SAND = "#faf7f1";

const APP = "https://38thaveproperties.com";
const HABITABILITY = new Set(["plumbing", "hvac", "heating", "electrical", "pest"]);

type UnitJoin = { label: string; properties: { name: string | null } | null } | null;
const homeOf = (u: UnitJoin) =>
  u ? `${u.properties?.name ? `${u.properties.name} · ` : ""}${u.label}` : "—";

export async function buildDailyDigest(): Promise<{ subject: string; html: string }> {
  const db = createAdminClient() as unknown as SupabaseClient;
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const todayIso = now.toISOString().slice(0, 10);
  const in60 = new Date(now.getTime() + 60 * 86_400_000).toISOString().slice(0, 10);

  const [
    { data: pays },
    { data: maint },
    { data: openMaint },
    { data: apps },
    { data: waitlist },
    { data: ideas },
    { data: incidents },
    { data: newIncidents },
    { data: inspections },
    { data: endingOcc },
    { data: offers },
    { data: vendors },
    { data: unmatched },
  ] = await Promise.all([
    db.from("payments").select("amount_cents, units:unit_id(label, properties(name))").eq("status", "succeeded").gte("created_at", dayAgo)
      .returns<{ amount_cents: number; units: UnitJoin }[]>(),
    db.from("maintenance_requests").select("title, priority, created_at, units:unit_id(label, properties(name))").gte("created_at", dayAgo)
      .returns<{ title: string; priority: string; created_at: string; units: UnitJoin }[]>(),
    db.from("maintenance_requests").select("title, priority, category, created_at, units:unit_id(label, properties(name))").in("status", ["open", "in_progress"])
      .returns<{ title: string; priority: string; category: string; created_at: string; units: UnitJoin }[]>(),
    db.from("applications").select("first_name, last_name, properties(name)").gte("created_at", dayAgo)
      .returns<{ first_name: string; last_name: string; properties: { name: string | null } | null }[]>(),
    db.from("waitlist_entries").select("name").gte("created_at", dayAgo).returns<{ name: string }[]>(),
    db.from("community_posts").select("title").gte("created_at", dayAgo).returns<{ title: string }[]>(),
    db.from("incident_reports").select("id").eq("status", "new").returns<{ id: string }[]>(),
    db.from("incident_reports").select("log_number, units:unit_id(label, properties(name))").gte("created_at", dayAgo)
      .returns<{ log_number: string | null; units: UnitJoin }[]>(),
    db.from("inspections").select("kind, scheduled_for, units:unit_id(label, properties(name))").eq("scheduled_for", todayIso).neq("status", "cancelled")
      .returns<{ kind: string; scheduled_for: string; units: UnitJoin }[]>(),
    db.from("unit_occupancy").select("unit_id, tenant_name, lease_end_date, units:unit_id(label, properties(name))")
      .not("lease_end_date", "is", null).gte("lease_end_date", todayIso).lte("lease_end_date", in60)
      .returns<{ unit_id: string; tenant_name: string | null; lease_end_date: string; units: UnitJoin }[]>(),
    db.from("renewal_offers").select("unit_id, status").in("status", ["draft", "sent", "accepted", "applied"])
      .returns<{ unit_id: string; status: string }[]>(),
    db.from("vendors").select("name, coi_expires_on").eq("active", true).not("coi_expires_on", "is", null).lt("coi_expires_on", todayIso)
      .returns<{ name: string; coi_expires_on: string }[]>(),
    db.from("profiles").select("full_name").not("signup_unit_id", "is", null).returns<{ full_name: string | null }[]>(),
  ]);

  // ---- yesterday ----
  const payCount = (pays ?? []).length;
  const payTotal = (pays ?? []).reduce((s, p) => s + p.amount_cents, 0);
  const newMaint = maint ?? [];
  const emergencies = newMaint.filter((m) => m.priority === "emergency");

  // ---- clocks: open habitability/emergency work past its response window ----
  const overdueClocks = (openMaint ?? []).filter((r) => {
    const emergency = r.priority === "emergency";
    const habitability = HABITABILITY.has(r.category);
    if (!emergency && !habitability) return false;
    const hours = (now.getTime() - new Date(r.created_at).getTime()) / 3600_000;
    return hours > (emergency ? 24 : 96);
  });

  // ---- renewals: leases ending ≤60d with no live offer ----
  const offered = new Set((offers ?? []).map((o) => o.unit_id));
  const needsOffer = (endingOcc ?? []).filter((o) => !offered.has(o.unit_id));

  const attentionCount =
    overdueClocks.length + (incidents ?? []).length + needsOffer.length +
    (vendors ?? []).length + (unmatched ?? []).length + (inspections ?? []).length;

  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // ---- render ----
  const li = (text: string, warn = false) =>
    `<li style="padding:7px 0;border-bottom:1px solid #f0e9db;font-size:15px;color:${warn ? TERRA : INK};line-height:1.5">${text}</li>`;
  const section = (title: string, color: string, items: string[], empty: string) =>
    `<div style="margin:0 0 22px">
      <div style="font-family:Georgia,serif;font-size:18px;color:${color};margin-bottom:6px">${title}</div>
      ${items.length ? `<ul style="margin:0;padding:0;list-style:none">${items.join("")}</ul>` : `<div style="font-size:14px;color:${FAINT};padding:6px 0">${empty}</div>`}
    </div>`;

  const yesterdayItems: string[] = [];
  if (payCount > 0) yesterdayItems.push(li(`💵 <strong>${payCount} rent payment${payCount === 1 ? "" : "s"}</strong> received — <strong style="color:${PINE}">${formatCents(payTotal)}</strong>`));
  for (const m of emergencies) yesterdayItems.push(li(`🚨 <strong>EMERGENCY maintenance:</strong> ${esc(m.title)} — ${esc(homeOf(m.units))}`, true));
  const routine = newMaint.length - emergencies.length;
  if (routine > 0) yesterdayItems.push(li(`🔧 ${routine} new maintenance request${routine === 1 ? "" : "s"}`));
  for (const i of newIncidents ?? []) yesterdayItems.push(li(`⚠️ Incident report <strong>${esc(i.log_number ?? "")}</strong> filed — ${esc(homeOf(i.units))}`, true));
  for (const a of apps ?? []) yesterdayItems.push(li(`📋 New application: <strong>${esc(a.first_name)} ${esc(a.last_name)}</strong>${a.properties?.name ? ` — ${esc(a.properties.name)}` : ""}`));
  if ((waitlist ?? []).length > 0) yesterdayItems.push(li(`📝 ${(waitlist ?? []).length} joined the waitlist`));
  for (const idea of ideas ?? []) yesterdayItems.push(li(`💡 New community idea: “${esc(idea.title)}”`));

  const attentionItems: string[] = [];
  for (const r of overdueClocks) {
    attentionItems.push(li(`⏰ <strong>Response window passed:</strong> ${esc(r.title)} — ${esc(homeOf(r.units))}. Colorado clock (${r.priority === "emergency" ? "24h" : "96h"}) has run — get someone out today.`, true));
  }
  if ((incidents ?? []).length > 0) attentionItems.push(li(`🗂 ${(incidents ?? []).length} incident report${(incidents ?? []).length === 1 ? "" : "s"} awaiting review`, true));
  for (const insp of inspections ?? []) attentionItems.push(li(`🔍 Inspection today: ${esc(homeOf(insp.units))}`));
  for (const o of needsOffer.slice(0, 6)) {
    const [y, m, d] = o.lease_end_date.split("-").map(Number);
    const end = new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    attentionItems.push(li(`📄 Lease ends <strong>${end}</strong> — ${esc(homeOf(o.units))} (${esc(o.tenant_name ?? "tenant")}) has <strong>no renewal offer yet</strong>. CO needs 60-day notice for changes.`));
  }
  for (const v of vendors ?? []) attentionItems.push(li(`🛡 ${esc(v.name)}'s insurance (COI) has <strong>expired</strong> — get a fresh certificate before their next job.`, true));
  if ((unmatched ?? []).length > 0) attentionItems.push(li(`👤 ${(unmatched ?? []).length} new signup${(unmatched ?? []).length === 1 ? "" : "s"} waiting to be matched to a unit`));

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center">
  <table role="presentation" width="620" style="width:620px;max-width:620px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${PINE};padding:22px 28px">
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div>
      <div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Morning digest · ${esc(dateLabel)}</div>
    </td></tr>
    <tr><td style="padding:24px 28px 4px">
      <div style="font-size:16px;color:${INK};line-height:1.6;margin-bottom:20px">
        Good morning. ${payCount > 0 ? `<strong style="color:${PINE}">${formatCents(payTotal)}</strong> came in yesterday.` : "No payments landed yesterday."}
        ${attentionCount > 0 ? ` <strong style="color:${TERRA}">${attentionCount} thing${attentionCount === 1 ? "" : "s"}</strong> could use your attention today.` : ` <strong style="color:${PINE}">Nothing needs your attention today.</strong> 🎉`}
      </div>
      ${section("What happened yesterday", INK, yesterdayItems, "A quiet day — nothing new came in.")}
      ${section("Needs attention today", attentionCount > 0 ? TERRA : PINE, attentionItems, "All clear — clocks green, nothing waiting.")}
      <div style="background:${SAND};border:1px solid ${LINE};border-radius:10px;padding:12px 16px;margin-bottom:8px">
        <a href="${APP}/admin" style="color:${PINE};font-weight:600;text-decoration:none;font-size:14px">Open the dashboard →</a>
        <span style="color:${FAINT};font-size:13px"> · </span>
        <a href="${APP}/admin/rent-board" style="color:${PINE};font-weight:600;text-decoration:none;font-size:14px">Rent board</a>
        <span style="color:${FAINT};font-size:13px"> · </span>
        <a href="${APP}/admin/maintenance" style="color:${PINE};font-weight:600;text-decoration:none;font-size:14px">Maintenance</a>
      </div>
    </td></tr>
    <tr><td style="padding:8px 28px 24px">
      <p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6;border-top:1px solid #f0e9db;padding-top:12px">Sent every morning to the owners of 38th Ave Properties. Reply to this email to reach the office.</p>
    </td></tr>
  </table></td></tr></table></div>`;

  const subject =
    attentionCount > 0
      ? `Morning digest — ${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention${payCount > 0 ? ` · ${formatCents(payTotal)} in` : ""}`
      : `Morning digest — all clear${payCount > 0 ? ` · ${formatCents(payTotal)} in` : ""}`;

  return { subject, html };
}
