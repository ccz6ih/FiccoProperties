import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PlanRow = {
  id: string;
  unit_id: string | null;
  total_cents: number;
  down_payment_cents: number;
  status: string;
  created_at: string;
  units: { label: string; properties: { name: string | null } | null } | null;
};
type ItemRow = { plan_id: string; amount_cents: number; status: string };

export default async function RepaymentPlans() {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) redirect("/portal");

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: plans } = await db
    .from("repayment_plans")
    .select("id, unit_id, total_cents, down_payment_cents, status, created_at, units:unit_id(label, properties(name))")
    .order("created_at", { ascending: false })
    .returns<PlanRow[]>();

  const ids = (plans ?? []).map((p) => p.id);
  const paidByPlan = new Map<string, number>();
  const countByPlan = new Map<string, { paid: number; total: number }>();
  if (ids.length > 0) {
    const { data: items } = await db
      .from("repayment_plan_items")
      .select("plan_id, amount_cents, status")
      .in("plan_id", ids)
      .returns<ItemRow[]>();
    for (const it of items ?? []) {
      const c = countByPlan.get(it.plan_id) ?? { paid: 0, total: 0 };
      c.total += 1;
      if (it.status === "paid") {
        c.paid += 1;
        paidByPlan.set(it.plan_id, (paidByPlan.get(it.plan_id) ?? 0) + it.amount_cents);
      }
      countByPlan.set(it.plan_id, c);
    }
  }

  const rows = plans ?? [];
  const activeCount = rows.filter((p) => p.status === "active").length;

  // Tenant names — occupancy fetched separately (nested embeds come back empty).
  const unitIds = [...new Set(rows.map((p) => p.unit_id).filter((v): v is string => !!v))];
  const tenantByUnit = new Map<string, string>();
  if (unitIds.length > 0) {
    const { data: occ } = await db
      .from("unit_occupancy")
      .select("unit_id, tenant_name")
      .in("unit_id", unitIds)
      .returns<{ unit_id: string; tenant_name: string | null }[]>();
    for (const o of occ ?? []) if (o.tenant_name) tenantByUnit.set(o.unit_id, o.tenant_name);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Repayment plans"
        subtitle="Structured catch-up agreements for tenants who are behind."
        action={
          <Link href="/admin/delinquency" className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand">
            Delinquency →
          </Link>
        }
      />

      {rows.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-clay bg-sand/50 px-5 py-2.5 text-xs text-ink-faint">
            {activeCount} active · {rows.length} total
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Tenant</th>
                  <th className="px-5 py-3 font-medium">Home</th>
                  <th className="px-5 py-3 text-right font-medium">Balance</th>
                  <th className="px-5 py-3 font-medium">Progress</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {rows.map((p) => {
                  const prog = countByPlan.get(p.id) ?? { paid: 0, total: 0 };
                  const paidCents = paidByPlan.get(p.id) ?? 0;
                  const tenant = (p.unit_id ? tenantByUnit.get(p.unit_id) : null) ?? "—";
                  return (
                    <tr key={p.id} className="hover:bg-sand/30">
                      <td className="px-5 py-3">
                        <Link href={`/admin/repayment-plans/${p.id}`} className="font-medium text-pine hover:text-pine-dark">
                          {tenant}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        <Link href={`/admin/repayment-plans/${p.id}`} className="hover:text-pine">
                          {p.units?.properties?.name} · {p.units?.label}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right text-ink">{formatCents(p.total_cents)}</td>
                      <td className="px-5 py-3 text-ink-soft">
                        {prog.paid}/{prog.total} · {formatCents(paidCents)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            p.status === "active"
                              ? "bg-gold/15 text-gold"
                              : p.status === "completed"
                                ? "bg-pine/10 text-pine"
                                : "bg-clay text-ink-faint"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{formatDate(p.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No repayment plans yet"
          body="From Delinquency, offer a tenant a structured catch-up plan — a good-faith move that often resolves things before court."
        />
      )}
    </div>
  );
}
