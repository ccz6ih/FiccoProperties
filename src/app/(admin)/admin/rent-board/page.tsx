import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { RentBoard, type BoardGroup, type BoardCharge } from "@/components/rent-board";
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
      .select("id, unit_id, status, due_date, amount_cents")
      .eq("period", period)
      .neq("status", "void")
      .returns<ChargeRow[]>(),
  ]);

  const occByUnit = new Map<string, OccRow>();
  for (const o of occ ?? []) occByUnit.set(o.unit_id, o);
  const chargeByUnit = new Map<string, ChargeRow>();
  for (const c of charges ?? []) if (c.unit_id) chargeByUnit.set(c.unit_id, c);

  const byProp = new Map<string, BoardCharge[]>();
  for (const u of units ?? []) {
    const property = u.properties?.name ?? "Unassigned";
    const o = occByUnit.get(u.id);
    const occupied = !!o && !!(o.tenant_name || o.occupant_profile_id);
    const charge = chargeByUnit.get(u.id);

    let status: BoardCharge["status"];
    if (!occupied) status = "vacant";
    else if (charge)
      status = charge.status === "paid" ? "paid" : charge.due_date && charge.due_date < todayIso ? "overdue" : "open";
    else status = "unbilled";

    const arr = byProp.get(property) ?? [];
    arr.push({
      id: charge?.id ?? null,
      name: occupied ? o?.profiles?.full_name ?? o?.tenant_name ?? "—" : "Vacant",
      unit: u.label,
      amountCents: charge?.amount_cents ?? o?.rent_cents ?? 0,
      status,
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
      const collectedCents = occupiedRows.filter((c) => c.status === "paid").reduce((s, c) => s + c.amountCents, 0);
      const outstandingCents = occupiedRows
        .filter((c) => c.status === "open" || c.status === "overdue" || c.status === "unbilled")
        .reduce((s, c) => s + c.amountCents, 0);
      return { property, charges: list, paid, total: occupiedRows.length, collectedCents, outstandingCents };
    })
    .sort((a, b) => a.property.localeCompare(b.property));

  const hasUnits = (units ?? []).length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Rent board"
        subtitle="Every unit by community — paid, due, overdue, or vacant."
        action={
          <div className="flex items-center gap-3 print:hidden">
            <form method="get">
              <input
                type="month"
                name="period"
                defaultValue={period}
                className="rounded-lg border border-clay-deep bg-white px-3 py-1.5 text-sm text-ink"
              />
            </form>
            <Link href="/admin/payments" className="text-sm font-medium text-pine hover:text-pine-dark">
              Payments →
            </Link>
          </div>
        }
      />

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
