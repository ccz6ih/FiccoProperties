/**
 * Open loops — the things that were started and never closed.
 *
 * Every screen here answers "what is true right now". None of them answered
 * "what did I start that is still waiting on me", so a notice served in
 * October sat as 'served' three weeks after it was paid, a turn stayed open
 * after the work was done, and the only reminder was remembering.
 *
 * Nothing here is stored. Each loop is derived from the records themselves, so
 * it closes the moment the underlying thing is actually dealt with — there is
 * no second list to keep up to date, which is the trap that made the first one
 * necessary.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Urgency = "overdue" | "soon" | "watch";

export type FollowUp = {
  id: string;
  /** Grouping label, e.g. "Notice", "Deposit", "Turn". */
  kind: string;
  urgency: Urgency;
  title: string;
  detail: string;
  /** What to do about it, in one short phrase. */
  action: string;
  href: string;
  /** The date it hinges on, for sorting and display. */
  onDate: string | null;
  /**
   * Closable from the list itself. Only set where the right answer is
   * unambiguous — a notice whose balance is already clear, a deposit that's
   * been returned, a turn whose work is done. Anything needing a judgement
   * call keeps only its link, so nothing consequential is one stray click
   * away.
   */
  quick?: { kind: "notice_cured" | "deposit_settled" | "turn_complete"; target: string; label: string };
};

const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000
  );
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const homeLabel = (u: { label: string; properties: { name: string | null } | null } | null) =>
  u ? `${u.properties?.name ? `${u.properties.name} · ` : ""}${u.label}` : "—";

/** Money still owed on a home right now, across every open charge. */
async function owedOnUnit(db: SupabaseClient, unitId: string): Promise<number> {
  const { data: charges } = await db
    .from("charges")
    .select("id, amount_cents")
    .eq("unit_id", unitId)
    .in("status", ["open", "past_due"])
    .returns<{ id: string; amount_cents: number }[]>();
  if (!charges || charges.length === 0) return 0;

  const { data: paid } = await db
    .from("payments")
    .select("charge_id, amount_cents")
    .in(
      "charge_id",
      charges.map((c) => c.id)
    )
    .eq("status", "succeeded")
    .returns<{ charge_id: string | null; amount_cents: number }[]>();

  const byCharge = new Map<string, number>();
  for (const p of paid ?? []) {
    if (!p.charge_id) continue;
    byCharge.set(p.charge_id, (byCharge.get(p.charge_id) ?? 0) + p.amount_cents);
  }
  return charges.reduce(
    (s, c) => s + Math.max(0, c.amount_cents - (byCharge.get(c.id) ?? 0)),
    0
  );
}

const usd = (c: number) =>
  (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export async function getFollowUps(db: SupabaseClient): Promise<FollowUp[]> {
  const now = today();
  const out: FollowUp[] = [];

  // 1. Notices served whose cure date has passed. The single biggest source of
  //    stale records: it gets paid, and nobody comes back to mark it.
  try {
    const { data: notices } = await db
      .from("notices")
      .select("id, type, cure_by, served_at, unit_id, units:unit_id(label, properties(name))")
      .eq("status", "served")
      .returns<
        {
          id: string;
          type: string;
          cure_by: string | null;
          served_at: string | null;
          unit_id: string;
          units: { label: string; properties: { name: string | null } | null } | null;
        }[]
      >();

    for (const n of notices ?? []) {
      if (!n.cure_by || n.cure_by >= now) continue;
      const owed = await owedOnUnit(db, n.unit_id);
      const settled = owed === 0;
      out.push({
        id: `notice-${n.id}`,
        kind: "Notice",
        urgency: "overdue",
        title: `${homeLabel(n.units)} — cure date passed ${daysBetween(n.cure_by, now)} days ago`,
        detail: settled
          ? "They owe nothing now, so this was almost certainly paid. It's still on the books as served."
          : `${usd(owed)} is still outstanding. The cure window has closed.`,
        action: settled ? "Mark it cured" : "Decide: file, or give more time",
        href: `/admin/notices/${n.id}`,
        onDate: n.cure_by,
        ...(settled
          ? {
              quick: {
                kind: "notice_cured" as const,
                target: n.id,
                label: "Mark it cured",
              },
            }
          : {}),
      });
    }
  } catch {
    /* a missing column shouldn't cost the whole list */
  }

  // 2. Deposits after a move-out. Colorado gives 30 days from the day
  //    possession comes back (C.R.S. 38-12-103) — this is the one with a
  //    statutory deadline rather than a preference.
  try {
    const { data: past } = await db
      .from("tenancy_history")
      .select(
        "id, unit_id, tenant_name, move_out_date, deposit_cents, forwarding_address, units:unit_id(label, properties(name))"
      )
      .not("move_out_date", "is", null)
      .gte("move_out_date", addDays(now, -120))
      .returns<
        {
          id: string;
          unit_id: string;
          tenant_name: string | null;
          move_out_date: string;
          deposit_cents: number | null;
          forwarding_address: string | null;
          units: { label: string; properties: { name: string | null } | null } | null;
        }[]
      >();

    for (const t of past ?? []) {
      if (!t.deposit_cents) continue;
      const { data: settlement } = await db
        .from("deposit_settlements")
        .select("status")
        .eq("unit_id", t.unit_id)
        .maybeSingle<{ status: string | null }>();
      if (settlement?.status === "finalized") continue;

      const deadline = addDays(t.move_out_date, 30);
      const left = daysBetween(now, deadline);
      out.push({
        id: `deposit-${t.id}`,
        kind: "Deposit",
        urgency: left < 0 ? "overdue" : left <= 10 ? "soon" : "watch",
        title: `${homeLabel(t.units)} — ${t.tenant_name ?? "deposit"} not settled`,
        detail:
          left < 0
            ? `${usd(t.deposit_cents)} held. The 30-day deadline passed ${Math.abs(left)} days ago.`
            : `${usd(t.deposit_cents)} held. Colorado's 30-day deadline is ${deadline}${
                t.forwarding_address ? "" : " — and there's no forwarding address on file"
              }.`,
        action: "Finalise the deposit statement",
        href: `/admin/move-out/${t.unit_id}`,
        onDate: deadline,
        quick: {
          kind: "deposit_settled" as const,
          target: t.unit_id,
          label: "It's been returned",
        },
      });
    }
  } catch {
    /* ignore */
  }

  // 3. Turns left open. Usually the work is done and the box wasn't ticked.
  try {
    const { data: turns } = await db
      .from("makeready_turns")
      .select("id, unit_id, status, created_at, units:unit_id(label, properties(name))")
      .neq("status", "complete")
      .returns<
        {
          id: string;
          unit_id: string;
          status: string;
          created_at: string;
          units: { label: string; properties: { name: string | null } | null } | null;
        }[]
      >();

    for (const t of turns ?? []) {
      const started = t.created_at.slice(0, 10);
      const age = daysBetween(started, now);
      out.push({
        id: `turn-${t.id}`,
        kind: "Turn",
        urgency: age > 30 ? "overdue" : age > 14 ? "soon" : "watch",
        title: `${homeLabel(t.units)} — make-ready still open`,
        detail: `Started ${started}, ${age} days ago. Every day it's open is a day it isn't earning.`,
        action: "Finish it, or tick off what's done",
        href: `/admin/units/${t.unit_id}`,
        onDate: started,
        quick: {
          kind: "turn_complete" as const,
          target: t.id,
          label: "It's finished",
        },
      });
    }
  } catch {
    /* ignore */
  }

  // 4. New residents who have stalled part-way through their welcome, and
  //    move-in money that hasn't arrived.
  try {
    const { data: settling } = await db
      .from("unit_occupancy")
      .select(
        "unit_id, tenant_name, move_in_date, move_in_confirmed_at, payment_preference, rent_cents, deposit_cents, deposit_received_cents, onboarding_completed_at, notice_move_out_on, units:unit_id(label, properties(name))"
      )
      .is("onboarding_completed_at", null)
      .not("tenant_name", "is", null)
      // Records-only tenancies have no portal account, so there is no welcome
      // for them to be part-way through — without this every long-settled
      // resident without a login reads as a stalled new one.
      .not("occupant_profile_id", "is", null)
      .returns<
        {
          unit_id: string;
          tenant_name: string | null;
          move_in_date: string | null;
          move_in_confirmed_at: string | null;
          payment_preference: string | null;
          rent_cents: number | null;
          deposit_cents: number | null;
          deposit_received_cents: number | null;
          units: { label: string; properties: { name: string | null } | null } | null;
        }[]
      >();

    for (const s of settling ?? []) {
      const waiting: string[] = [];
      if (!s.payment_preference) waiting.push("how they'll pay");
      if (!s.move_in_confirmed_at) waiting.push("their move-in day");

      if (waiting.length > 0) {
        out.push({
          id: `onboarding-${s.unit_id}`,
          kind: "New resident",
          urgency: "watch",
          title: `${homeLabel(s.units)} — ${s.tenant_name} hasn't finished their welcome`,
          detail: `Still waiting on ${waiting.join(" and ")}. They may need a nudge, or the invite may never have arrived.`,
          action: "Check the email log, or call them",
          href: `/admin/units/${s.unit_id}`,
          onDate: s.move_in_date,
        });
      }

      // Money due before the keys.
      if (s.move_in_confirmed_at && s.deposit_cents) {
        const received = s.deposit_received_cents ?? 0;
        if (received < s.deposit_cents) {
          const left = s.move_in_date ? daysBetween(now, s.move_in_date) : null;
          out.push({
            id: `movein-money-${s.unit_id}`,
            kind: "Move-in money",
            urgency: left != null && left <= 3 ? "soon" : "watch",
            title: `${homeLabel(s.units)} — ${usd(s.deposit_cents - received)} deposit not in`,
            detail:
              left != null
                ? left < 0
                  ? `They moved in ${Math.abs(left)} days ago and the deposit still isn't recorded.`
                  : `They move in in ${left} days. It's due before the keys.`
                : "Due before the keys change hands.",
            action: "Record it once it's in hand",
            href: `/admin/units/${s.unit_id}`,
            onDate: s.move_in_date,
          });
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 5. Homes with notice given. Not a failure — just the thing most worth
  //    seeing early, because the turn can be planned before it's empty.
  try {
    const { data: leaving } = await db
      .from("unit_occupancy")
      .select("unit_id, tenant_name, notice_move_out_on, units:unit_id(label, properties(name))")
      .not("notice_move_out_on", "is", null)
      .returns<
        {
          unit_id: string;
          tenant_name: string | null;
          notice_move_out_on: string;
          units: { label: string; properties: { name: string | null } | null } | null;
        }[]
      >();

    for (const l of leaving ?? []) {
      const left = daysBetween(now, l.notice_move_out_on);
      if (left > 60) continue;
      out.push({
        id: `leaving-${l.unit_id}`,
        kind: "Coming empty",
        urgency: left < 0 ? "overdue" : left <= 14 ? "soon" : "watch",
        title: `${homeLabel(l.units)} — ${l.tenant_name ?? "resident"} leaving ${l.notice_move_out_on}`,
        detail:
          left < 0
            ? `That date has passed. If they're out, record the move-out so the deposit clock starts properly.`
            : `${left} days. Book the make-ready and get the listing up now, not after they've gone.`,
        action: left < 0 ? "Record the move-out" : "Plan the turn and list it",
        href: left < 0 ? `/admin/move-out/${l.unit_id}` : `/admin/units/${l.unit_id}`,
        onDate: l.notice_move_out_on,
      });
    }
  } catch {
    /* ignore */
  }

  const rank: Record<Urgency, number> = { overdue: 0, soon: 1, watch: 2 };
  return out.sort(
    (a, b) => rank[a.urgency] - rank[b.urgency] || (a.onDate ?? "").localeCompare(b.onDate ?? "")
  );
}
