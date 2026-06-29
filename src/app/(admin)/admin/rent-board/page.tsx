import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { RentBoard, type BoardGroup, type BoardCharge } from "@/components/rent-board";
import { createClient } from "@/lib/supabase/server";

type ChargeRow = {
  id: string;
  amount_cents: number;
  due_date: string | null;
  status: string;
  profiles: { full_name: string | null } | null;
  leases: { units: { label: string; properties: { name: string | null } | null } | null } | null;
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
const statusOrder = { overdue: 0, open: 1, paid: 2 } as const;

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

  const { data: charges } = await db
    .from("charges")
    .select(
      "id, amount_cents, due_date, status, profiles:resident_id(full_name), leases(units(label, properties(name)))"
    )
    .eq("period", period)
    .neq("status", "void")
    .returns<ChargeRow[]>();

  const all = charges ?? [];

  // Group by community.
  const byProp = new Map<string, BoardCharge[]>();
  for (const c of all) {
    const property = c.leases?.units?.properties?.name ?? "Unassigned";
    const status: BoardCharge["status"] =
      c.status === "paid"
        ? "paid"
        : c.due_date && c.due_date < todayIso
          ? "overdue"
          : "open";
    const arr = byProp.get(property) ?? [];
    arr.push({
      id: c.id,
      name: c.profiles?.full_name ?? "—",
      unit: c.leases?.units?.label ?? "—",
      amountCents: c.amount_cents,
      status,
    });
    byProp.set(property, arr);
  }

  const groups: BoardGroup[] = [...byProp.entries()]
    .map(([property, list]) => {
      list.sort(
        (a, b) => statusOrder[a.status] - statusOrder[b.status] || a.unit.localeCompare(b.unit, undefined, { numeric: true })
      );
      const paid = list.filter((c) => c.status === "paid").length;
      const collectedCents = list.filter((c) => c.status === "paid").reduce((s, c) => s + c.amountCents, 0);
      const outstandingCents = list.filter((c) => c.status !== "paid").reduce((s, c) => s + c.amountCents, 0);
      return { property, charges: list, paid, total: list.length, collectedCents, outstandingCents };
    })
    .sort((a, b) => a.property.localeCompare(b.property));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Rent board"
        subtitle="Who's paid and who's not — by community, at a glance."
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

      {/* Printed title */}
      <div className="mb-4 hidden print:block">
        <div className="font-display text-xl font-semibold text-ink">
          38th Ave Properties — Rent board · {periodLabel(period)}
        </div>
      </div>

      {all.length > 0 ? (
        <RentBoard groups={groups} periodLabel={periodLabel(period)} />
      ) : (
        <EmptyState
          title={`No charges for ${periodLabel(period)}`}
          body="Generate this month's rent on the Payments page first, then this board fills in."
          action={
            <Link href="/admin/payments" className="text-sm font-medium text-pine hover:underline">
              Go to Payments →
            </Link>
          }
        />
      )}
    </div>
  );
}
