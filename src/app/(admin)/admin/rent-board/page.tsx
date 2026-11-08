import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { RentBoard, type BoardGroup, type BoardCharge } from "@/components/rent-board";
import { RentBoardMonthNav } from "@/components/rent-board-month-nav";
import { createClient } from "@/lib/supabase/server";

type UnitRow = {
  id: string;
  label: string;
  status: string;
  properties: { name: string | null } | null;
};
type OccRow = {
  unit_id: string;
  tenant_name: string | null;
  occupant_profile_id: string | null;
  rent_cents: number | null;
  profiles: { full_name: string | null } | null;
};
type ChargeRow = {
  id: string;
  unit_id: string | null;
  status: string;
  due_date: string | null;
  amount_cents: number;
  description: string | null;
};

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
const statusOrder = { overdue: 0, open: 1, unbilled: 2, paid: 3, vacant: 4 } as const;

export default async function RentBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(periodParam ?? "") ? periodParam! : currentPeriod();

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const todayIso = new Date().toISOString().slice(0, 10);

  const [{ data: units }, { data: occ }, { data: charges }] = await Promise.all([
    db.from("units").select("id, label, status, properties(name)").returns<UnitRow[]>(),
    db
      .from("unit_occupancy")
      .select("unit_id, tenant_name, occupant_profile_id, rent_cents, profiles:occupant_profile_id(full_name)")
      .returns<OccRow[]>(),
    db
      .from("charges")
      .select("id, unit_id, status, due_date, amount_cents, description")
      .eq("period", period)
      .neq("status", "void")
      .returns<ChargeRow[]>(),
  ]);

  const occByUnit = new Map<string, OccRow>();
  for (const o of occ ?? []) occByUnit.set(o.unit_id, o);
  // Every charge on the home, not just one of them.
  //
  // This used to be a Map keyed by unit, so a home billed rent AND a late fee
  // kept whichever arrived last — in practice the late fee, because it is
  // raised afterwards. The board then showed Yadira Olivas owing $68.75 when
  // she owed $1,443.75, and the community totals were short by the rent of
  // every late tenant.
  const chargesByUnit = new Map<string, ChargeRow[]>();
  for (const c of charges ?? []) {
    if (!c.unit_id) continue;
    chargesByUnit.set(c.unit_id, [...(chargesByUnit.get(c.unit_id) ?? []), c]);
  }

  // Payment reference (check / money-order #) for this period's charges, so the
  // board and its printout show how each paid unit paid.
  const chargeIds = (charges ?? []).map((c) => c.id);
  const refByCharge = new Map<string, string>();
  const paidByCharge = new Map<string, number>();
  const paidDateByCharge = new Map<string, string>();
  if (chargeIds.length > 0) {
    const { data: payments } = await db
      .from("payments")
      .select("charge_id, provider_ref, created_at, amount_cents")
      .in("charge_id", chargeIds)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .returns<
        {
          charge_id: string | null;
          provider_ref: string | null;
          created_at: string;
          amount_cents: number;
        }[]
      >();
    for (const p of payments ?? []) {
      if (!p.charge_id) continue;
      paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_cents);
      // Newest-first, so the first one seen is the latest payment date.
      if (!paidDateByCharge.has(p.charge_id)) paidDateByCharge.set(p.charge_id, p.created_at);
      if (refByCharge.has(p.charge_id)) continue;
      if (p.provider_ref && p.provider_ref !== "offline") {
        refByCharge.set(p.charge_id, p.provider_ref);
      }
    }
  }

  const byProp = new Map<string, BoardCharge[]>();
  for (const u of units ?? []) {
    const property = u.properties?.name ?? "Unassigned";
    const o = occByUnit.get(u.id);
    const occupied = !!o && !!(o.tenant_name || o.occupant_profile_id);
    const unitCharges = chargesByUnit.get(u.id) ?? [];

    const billedCents = unitCharges.reduce((sum, c) => sum + c.amount_cents, 0);
    const receivedCents = unitCharges.reduce(
      (sum, c) => sum + Math.min(c.amount_cents, paidByCharge.get(c.id) ?? 0),
      0
    );
    const outstandingCents = Math.max(0, billedCents - receivedCents);

    // Charges still carrying a balance — what "mark paid" has to settle, and
    // what decides whether the home reads as overdue.
    const unpaid = unitCharges.filter(
      (c) => c.amount_cents - (paidByCharge.get(c.id) ?? 0) > 0
    );
    // A late fee alongside rent is worth naming: "$1,470" on its own invites
    // the question, and that question is a phone call.
    const lateFeeCents = unpaid
      .filter((c) => (c.description ?? "").toLowerCase().includes("late fee"))
      .reduce((sum, c) => sum + c.amount_cents - (paidByCharge.get(c.id) ?? 0), 0);

    let status: BoardCharge["status"];
    if (!occupied) status = "vacant";
    else if (unitCharges.length === 0) status = "unbilled";
    else if (outstandingCents === 0) status = "paid";
    else if (unpaid.some((c) => c.due_date && c.due_date < todayIso)) status = "overdue";
    else status = "open";

    // The newest payment across the home's charges names how they paid.
    const settled = unitCharges
      .filter((c) => paidByCharge.has(c.id))
      .sort((a, b) =>
        (paidDateByCharge.get(b.id) ?? "").localeCompare(paidDateByCharge.get(a.id) ?? "")
      );

    const arr = byProp.get(property) ?? [];
    arr.push({
      id: unpaid[0]?.id ?? unitCharges[0]?.id ?? null,
      chargeIds: unpaid.map((c) => c.id),
      name: occupied ? o?.profiles?.full_name ?? o?.tenant_name ?? "—" : "Vacant",
      unit: u.label,
      // Paid homes show what came in; the rest show what is still owed.
      amountCents:
        unitCharges.length === 0
          ? o?.rent_cents ?? 0
          : status === "paid"
            ? billedCents
            : outstandingCents,
      lateFeeCents: lateFeeCents > 0 ? lateFeeCents : null,
      billedCents: unitCharges.length === 0 ? o?.rent_cents ?? 0 : billedCents,
      receivedCents,
      status,
      paidRef: status === "paid" && settled[0] ? refByCharge.get(settled[0].id) ?? null : null,
      paidDate: status === "paid" && settled[0] ? paidDateByCharge.get(settled[0].id) ?? null : null,
    });
    byProp.set(property, arr);
  }

  const groups: BoardGroup[] = [...byProp.entries()]
    .map(([property, list]) => {
      list.sort(
        (a, b) =>
          statusOrder[a.status] - statusOrder[b.status] ||
          a.unit.localeCompare(b.unit, undefined, { numeric: true })
      );
      const occupiedRows = list.filter((c) => c.status !== "vacant");
      const paid = occupiedRows.filter((c) => c.status === "paid").length;
      // Summed from money actually received and still owed, rather than from
      // each row's headline figure — otherwise a home that has part-paid
      // counts as nothing collected, and the community looks further behind
      // than it is.
      const collectedCents = occupiedRows.reduce((s, c) => s + c.receivedCents, 0);
      const outstandingCents = occupiedRows.reduce(
        (s, c) => s + Math.max(0, c.billedCents - c.receivedCents),
        0
      );
      return { property, charges: list, paid, total: occupiedRows.length, collectedCents, outstandingCents };
    })
    .sort((a, b) => a.property.localeCompare(b.property));

  const hasUnits = (units ?? []).length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="print:hidden">
        <PageHeader
          title="Rent board"
          subtitle="Every unit by community — paid, due, overdue, or vacant."
          action={
            <div className="flex items-center gap-3">
              <RentBoardMonthNav period={period} />
              <Link href="/admin/payments" className="text-sm font-medium text-pine hover:text-pine-dark">
                Payments →
              </Link>
            </div>
          }
        />
      </div>

      <div className="mb-4 hidden print:block">
        <div className="font-display text-xl font-semibold text-ink">
          38th Ave Properties — Rent board · {periodLabel(period)}
        </div>
      </div>

      {hasUnits ? (
        <RentBoard groups={groups} periodLabel={periodLabel(period)} />
      ) : (
        <EmptyState title="No units yet" body="Add properties and units to see the rent board." />
      )}
    </div>
  );
}
