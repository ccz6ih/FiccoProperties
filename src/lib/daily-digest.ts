/**
 * Weekly owner digest — Monday mornings, covering the whole prior week:
 * money in, what happened, what got DONE (completed maintenance, finished
 * tasks), what the office put in motion (tasks, notices, offers, bills),
 * notes from the field, what needs attention — and a closing quote.
 * Urgent events (emergencies, incidents) still email owners instantly.
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
  // Everything since the previous edition (fallback: the last 8 days).
  const sinceIso = sinceIsoInput || new Date(now.getTime() - 8 * 86_400_000).toISOString();
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
    { data: newTasks },
    { data: newNotices },
    { data: newAnnouncements },
    { data: newOffers },
    { data: newInspections },
    { data: newBills },
    { data: newExpenses },
    { data: newVendors },
    { data: answeredIdeas },
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
    db.from("tasks").select("title, created_at").gte("created_at", sinceIso).neq("status", "cancelled")
      .returns<{ title: string; created_at: string }[]>(),
    db.from("notices").select("title, type, units:unit_id(label, properties(name))").gte("created_at", sinceIso)
      .returns<{ title: string; type: string; units: UnitJoin }[]>(),
    db.from("announcements").select("title").gte("created_at", sinceIso).returns<{ title: string }[]>(),
    db.from("renewal_offers").select("new_rent_cents, units:unit_id(label, properties(name))").gte("created_at", sinceIso)
      .returns<{ new_rent_cents: number; units: UnitJoin }[]>(),
    db.from("inspections").select("scheduled_for, units:unit_id(label, properties(name))").gte("created_at", sinceIso)
      .returns<{ scheduled_for: string; units: UnitJoin }[]>(),
    db.from("unit_costs").select("amount_cents").gte("created_at", sinceIso).returns<{ amount_cents: number }[]>(),
    db.from("property_expenses").select("amount_cents").gte("created_at", sinceIso).returns<{ amount_cents: number }[]>(),
    db.from("vendors").select("name").gte("created_at", sinceIso).returns<{ name: string }[]>(),
    db.from("community_posts").select("title").not("staff_reply_at", "is", null).gte("staff_reply_at", sinceIso)
      .returns<{ title: string }[]>(),
  ]);

  // ---- rent still owed (current month) ----
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data: monthCharges } = await db
    .from("charges")
    .select("id, amount_cents, due_date, unit_id, units:unit_id(label, properties(name))")
    .eq("period", period)
    .neq("status", "void")
    .returns<{ id: string; amount_cents: number; due_date: string | null; unit_id: string | null; units: UnitJoin }[]>();
  const chargeIds = (monthCharges ?? []).map((c) => c.id);
  const paidByCharge = new Map<string, number>();
  if (chargeIds.length > 0) {
    const { data: chargePays } = await db
      .from("payments")
      .select("charge_id, amount_cents")
      .in("charge_id", chargeIds)
      .eq("status", "succeeded")
      .returns<{ charge_id: string | null; amount_cents: number }[]>();
    for (const p of chargePays ?? []) {
      if (p.charge_id) paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_cents);
    }
  }
  const { data: occNames } = await db
    .from("unit_occupancy")
    .select("unit_id, tenant_name")
    .returns<{ unit_id: string; tenant_name: string | null }[]>();
  const tenantByUnit = new Map((occNames ?? []).map((o) => [o.unit_id, o.tenant_name]));
  const owed = (monthCharges ?? [])
    .map((c) => ({
      home: homeOf(c.units),
      tenant: (c.unit_id ? tenantByUnit.get(c.unit_id) : null) ?? "—",
      remaining: Math.max(0, c.amount_cents - (paidByCharge.get(c.id) ?? 0)),
      daysLate:
        c.due_date && c.due_date < todayIso
          ? Math.max(0, Math.floor((now.getTime() - new Date(`${c.due_date}T12:00:00Z`).getTime()) / 86_400_000))
          : 0,
    }))
    .filter((c) => c.remaining > 0)
    .sort((a, b) => a.home.localeCompare(b.home, undefined, { numeric: true }));
  const owedTotal = owed.reduce((s, c) => s + c.remaining, 0);

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

  // ---- from the office: what Craig/staff put in motion this week ----
  const NOTICE_LABEL: Record<string, string> = {
    late_rent: "Late-rent reminder",
    pay_or_quit: "Demand for rent (pay or quit)",
    lease_violation: "Lease-violation notice",
    entry: "Notice of entry",
    general: "Notice",
  };
  const officeItems: string[] = [];
  const taskList = newTasks ?? [];
  if (taskList.length > 0) {
    const titles = taskList.slice(0, 4).map((t) => esc(t.title)).join(", ");
    officeItems.push(li(`📌 ${taskList.length} task${taskList.length === 1 ? "" : "s"} added — ${titles}${taskList.length > 4 ? "…" : ""}`));
  }
  for (const n of newNotices ?? []) {
    officeItems.push(li(`📮 ${NOTICE_LABEL[n.type] ?? "Notice"} — ${esc(homeOf(n.units))}`));
  }
  for (const a of newAnnouncements ?? []) {
    officeItems.push(li(`📣 Announcement posted: “${esc(a.title)}”`));
  }
  for (const o of newOffers ?? []) {
    officeItems.push(li(`📄 Renewal offer — ${esc(homeOf(o.units))} at ${formatCents(o.new_rent_cents)}/mo`));
  }
  for (const i of newInspections ?? []) {
    officeItems.push(li(`🔍 Inspection scheduled — ${esc(homeOf(i.units))}`));
  }
  const billCount = (newBills ?? []).length + (newExpenses ?? []).length;
  const billTotal =
    (newBills ?? []).reduce((s, b) => s + b.amount_cents, 0) +
    (newExpenses ?? []).reduce((s, e) => s + e.amount_cents, 0);
  if (billCount > 0) {
    officeItems.push(li(`🧾 ${billCount} bill${billCount === 1 ? "" : "s"}/expense${billCount === 1 ? "" : "s"} recorded — ${formatCents(billTotal)} for the books`));
  }
  for (const v of newVendors ?? []) {
    officeItems.push(li(`🤝 New contractor on file: ${esc(v.name)}`));
  }
  for (const idea of answeredIdeas ?? []) {
    officeItems.push(li(`💬 Replied to the community idea “${esc(idea.title)}”`));
  }

  // ---- rent-owed list items ----
  const owedItems: string[] = owed.slice(0, 15).map((c) =>
    li(
      `🏠 <strong>${esc(c.home)}</strong> — ${esc(c.tenant)} · <strong style="color:${TERRA}">${formatCents(c.remaining)}</strong>${
        c.daysLate > 0 ? ` <span style="color:${FAINT}">(${c.daysLate} day${c.daysLate === 1 ? "" : "s"} late)</span>` : ""
      }`,
      c.daysLate > 0
    )
  );
  if (owed.length > 15) owedItems.push(li(`…and ${owed.length - 15} more — see the rent board`));
  if (owed.length > 0) {
    owedItems.push(
      li(`<strong>Total still owed: <span style="color:${TERRA}">${formatCents(owedTotal)}</span></strong> across ${owed.length} unit${owed.length === 1 ? "" : "s"}`)
    );
  }

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
      <div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Weekly digest · ${esc(dateLabel)}</div>
    </td></tr>
    <tr><td style="padding:24px 28px 4px">
      <div style="font-size:16px;color:${INK};line-height:1.6;margin-bottom:20px">
        Good morning. ${payCount > 0 ? `<strong style="color:${PINE}">${formatCents(payTotal)}</strong> came in since the last digest.` : "No payments landed since the last digest."}
        ${owed.length > 0 ? ` <strong style="color:${TERRA}">${formatCents(owedTotal)}</strong> in rent is still owed by ${owed.length} unit${owed.length === 1 ? "" : "s"}.` : ` <strong style="color:${PINE}">Every unit is paid up.</strong>`}
        ${doneItems.length > 0 ? ` <strong>${doneItems.length}</strong> job${doneItems.length === 1 ? "" : "s"} got done.` : ""}
        ${attentionCount > 0 ? ` <strong style="color:${TERRA}">${attentionCount} thing${attentionCount === 1 ? "" : "s"}</strong> could use your attention today.` : ` <strong style="color:${PINE}">Nothing needs your attention today.</strong> 🎉`}
      </div>
      ${section("Rent still owed this month", owed.length > 0 ? TERRA : PINE, owedItems, "Everyone's paid — nothing owed. 🎉")}
      ${section("Since the last digest", INK, yesterdayItems, "A quiet stretch — nothing new came in.")}
      ${section("What got done ✅", PINE, doneItems, "No work closed out this stretch.")}
      ${section("From the office 🗂", INK, officeItems, "Nothing new put in motion this week.")}
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
      <p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6;border-top:1px solid #f0e9db;padding-top:12px">Sent every Monday morning to the owners of 38th Ave Properties. Reply to this email to reach the office.</p>
    </td></tr>
  </table></td></tr></table></div>`;

  const owedTag = owed.length > 0 ? ` · ${formatCents(owedTotal)} owed` : "";
  const subject =
    attentionCount > 0
      ? `Weekly digest — ${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention${payCount > 0 ? ` · ${formatCents(payTotal)} in` : ""}${owedTag}`
      : `Weekly digest — ${owed.length > 0 ? "rent to chase" : "all clear"}${payCount > 0 ? ` · ${formatCents(payTotal)} in` : ""}${owedTag}`;

  return { subject, html };
}
