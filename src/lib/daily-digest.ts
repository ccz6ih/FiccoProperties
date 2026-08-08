/**
 * Owner digest — Monday/Wednesday/Friday mornings. Everything since the last
 * edition: money in, what happened, what got DONE (completed maintenance,
 * finished tasks, work logged on units), notes from the field, what needs
 * attention today — and a closing quote. Big-type and plain-English.
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

/** A closing thought for the owners — one per edition, picked at random. */
const OWNER_QUOTES = [
  "“The best fertilizer is the farmer's footsteps.” — old proverb",
  "“Quality means doing it right when no one is looking.” — Henry Ford",
  "“Take care of your tenants and your tenants will take care of your buildings.”",
  "“Don't wait to buy real estate. Buy real estate and wait.” — Will Rogers",
  "“How you do anything is how you do everything.”",
  "“Small daily improvements are the key to staggering long-term results.”",
  "“A good reputation is more valuable than money.” — Publilius Syrus",
  "“Well done is better than well said.” — Benjamin Franklin",
  "“The way to get started is to quit talking and begin doing.” — Walt Disney",
  "“People will forget what you said, but never how you made them feel.” — Maya Angelou",
  "“Fix the leak when it's a drip, not a flood.”",
  "“Landlording done right is a neighborhood business, not a numbers business.”",
  "“It is not the beauty of a building you should look at; it's the construction of the foundation that will stand the test of time.” — David Allan Coe",
  "“Success is the sum of small efforts, repeated day in and day out.” — Robert Collier",
  "“Every tenant who renews is a marketing budget you didn't have to spend.”",
];

export async function buildDailyDigest(
  sinceIsoInput?: string | null
): Promise<{ subject: string; html: string }> {
  const db = createAdminClient() as unknown as SupabaseClient;
  const now = new Date();
  // Everything since the previous edition (fallback: the last 3 days).
  const sinceIso = sinceIsoInput || new Date(now.getTime() - 72 * 3600_000).toISOString();
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
    { data: completedMaint },
    { data: doneTasks },
    { data: fieldNotes },
  ] = await Promise.all([
    db.from("payments").select("amount_cents, units:unit_id(label, properties(name))").eq("status", "succeeded").gte("created_at", sinceIso)
      .returns<{ amount_cents: number; units: UnitJoin }[]>(),
    db.from("maintenance_requests").select("title, priority, created_at, units:unit_id(label, properties(name))").gte("created_at", sinceIso)
      .returns<{ title: string; priority: string; created_at: string; units: UnitJoin }[]>(),
    db.from("maintenance_requests").select("title, priority, category, created_at, units:unit_id(label, properties(name))").in("status", ["open", "in_progress"])
      .returns<{ title: string; priority: string; category: string; created_at: string; units: UnitJoin }[]>(),
    db.from("applications").select("first_name, last_name, properties(name)").gte("created_at", sinceIso)
      .returns<{ first_name: string; last_name: string; properties: { name: string | null } | null }[]>(),
    db.from("waitlist_entries").select("name").gte("created_at", sinceIso).returns<{ name: string }[]>(),
    db.from("community_posts").select("title").gte("created_at", sinceIso).returns<{ title: string }[]>(),
    db.from("incident_reports").select("id").eq("status", "new").returns<{ id: string }[]>(),
    db.from("incident_reports").select("log_number, units:unit_id(label, properties(name))").gte("created_at", sinceIso)
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
    db.from("maintenance_requests").select("title, completed_at, units:unit_id(label, properties(name))")
      .eq("status", "completed").gte("completed_at", sinceIso)
      .returns<{ title: string; completed_at: string; units: UnitJoin }[]>(),
    db.from("tasks").select("title, category, completed_at, unit:unit_id(label, properties(name)), property:property_id(name)")
      .eq("status", "done").gte("completed_at", sinceIso)
      .returns<{ title: string; category: string; completed_at: string; unit: UnitJoin; property: { name: string | null } | null }[]>(),
    db.from("unit_log_entries").select("kind, body, created_at, author:author_id(full_name), units:unit_id(label, properties(name))")
      .gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(8)
      .returns<{ kind: string; body: string; created_at: string; author: { full_name: string | null } | null; units: UnitJoin }[]>(),
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

  // ---- what got DONE since the last edition ----
  const doneItems: string[] = [];
  for (const m of completedMaint ?? []) {
    doneItems.push(li(`✅ <strong>${esc(m.title)}</strong> — ${esc(homeOf(m.units))} · completed`));
  }
  for (const t of doneTasks ?? []) {
    const where = t.unit ? homeOf(t.unit) : t.property?.name ?? null;
    doneItems.push(li(`✔️ ${esc(t.title)}${where ? ` — ${esc(where)}` : ""}`));
  }

  // ---- notes from the field (unit log) ----
  const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const noteItems: string[] = (fieldNotes ?? []).map((n) =>
    li(
      `${n.kind === "maintenance" ? "🔧" : "🗒"} <strong>${esc(homeOf(n.units))}</strong> — ${esc(clip(n.body))}${
        n.author?.full_name ? ` <span style="color:${FAINT}">(${esc(n.author.full_name.split(" ")[0])})</span>` : ""
      }`
    )
  );

  const quote = OWNER_QUOTES[Math.floor(Math.random() * OWNER_QUOTES.length)];

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
        Good morning. ${payCount > 0 ? `<strong style="color:${PINE}">${formatCents(payTotal)}</strong> came in since the last digest.` : "No payments landed since the last digest."}
        ${doneItems.length > 0 ? ` <strong>${doneItems.length}</strong> job${doneItems.length === 1 ? "" : "s"} got done.` : ""}
        ${attentionCount > 0 ? ` <strong style="color:${TERRA}">${attentionCount} thing${attentionCount === 1 ? "" : "s"}</strong> could use your attention today.` : ` <strong style="color:${PINE}">Nothing needs your attention today.</strong> 🎉`}
      </div>
      ${section("Since the last digest", INK, yesterdayItems, "A quiet stretch — nothing new came in.")}
      ${section("What got done ✅", PINE, doneItems, "No work closed out this stretch.")}
      ${noteItems.length > 0 ? section("Notes from the field", INK, noteItems, "") : ""}
      ${section("Needs attention today", attentionCount > 0 ? TERRA : PINE, attentionItems, "All clear — clocks green, nothing waiting.")}
      <div style="background:${SAND};border-left:3px solid #c9932f;border-top:1px solid ${LINE};border-right:1px solid ${LINE};border-bottom:1px solid ${LINE};border-radius:10px;padding:12px 16px;margin-bottom:14px">
        <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">A thought for the day</div>
        <div style="font-family:Georgia,serif;font-size:15px;font-style:italic;color:${INK};line-height:1.55">${esc(quote)}</div>
      </div>
      <div style="background:${SAND};border:1px solid ${LINE};border-radius:10px;padding:12px 16px;margin-bottom:8px">
        <a href="${APP}/admin" style="color:${PINE};font-weight:600;text-decoration:none;font-size:14px">Open the dashboard →</a>
        <span style="color:${FAINT};font-size:13px"> · </span>
        <a href="${APP}/admin/rent-board" style="color:${PINE};font-weight:600;text-decoration:none;font-size:14px">Rent board</a>
        <span style="color:${FAINT};font-size:13px"> · </span>
        <a href="${APP}/admin/maintenance" style="color:${PINE};font-weight:600;text-decoration:none;font-size:14px">Maintenance</a>
      </div>
    </td></tr>
    <tr><td style="padding:8px 28px 24px">
      <p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6;border-top:1px solid #f0e9db;padding-top:12px">Sent Monday, Wednesday, and Friday mornings to the owners of 38th Ave Properties. Reply to this email to reach the office.</p>
    </td></tr>
  </table></td></tr></table></div>`;

  const subject =
    attentionCount > 0
      ? `Morning digest — ${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention${payCount > 0 ? ` · ${formatCents(payTotal)} in` : ""}`
      : `Morning digest — all clear${payCount > 0 ? ` · ${formatCents(payTotal)} in` : ""}`;

  return { subject, html };
}
