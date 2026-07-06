import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { RepaymentPlanForm } from "@/components/repayment-plan-form";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type UnitRow = {
  label: string;
  properties: { name: string | null } | null;
};
type OccRow = { tenant_name: string | null };
type ChargeRow = { id: string; amount_cents: number; status: string; due_date: string | null };
type PaySum = { charge_id: string | null; amount_cents: number };

export default async function NewRepaymentPlan({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { profile } = await requireProfile("/admin/repayment-plans/new");
  if (!isStaff(profile)) redirect("/portal");

  const { unit: unitId } = await searchParams;
  if (!unitId) redirect("/admin/delinquency");

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: unit }, { data: occ }, { data: charges }] = await Promise.all([
    db.from("units").select("label, properties(name)").eq("id", unitId).maybeSingle<UnitRow>(),
    db.from("unit_occupancy").select("tenant_name").eq("unit_id", unitId).maybeSingle<OccRow>(),
    db.from("charges").select("id, amount_cents, status, due_date").eq("unit_id", unitId).in("status", ["open", "past_due"]).returns<ChargeRow[]>(),
  ]);

  if (!unit) redirect("/admin/delinquency");

  const ids = (charges ?? []).map((c) => c.id);
  const paid = new Map<string, number>();
  if (ids.length > 0) {
    const { data: pays } = await db
      .from("payments")
      .select("charge_id, amount_cents")
      .in("charge_id", ids)
      .eq("status", "succeeded")
      .returns<PaySum[]>();
    for (const p of pays ?? []) {
      if (p.charge_id) paid.set(p.charge_id, (paid.get(p.charge_id) ?? 0) + p.amount_cents);
    }
  }
  const outstandingCents = (charges ?? []).reduce(
    (s, c) => s + Math.max(0, c.amount_cents - (paid.get(c.id) ?? 0)),
    0
  );

  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New repayment plan"
        subtitle="Set up a structured catch-up schedule for a tenant who's behind."
        action={
          <Link href="/admin/delinquency" className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand">
            ← Delinquency
          </Link>
        }
      />
      <Card className="p-6">
        <RepaymentPlanForm
          unitId={unitId}
          tenant={occ?.tenant_name ?? "Resident"}
          home={`${unit.properties?.name ?? ""} · ${unit.label}`}
          defaultTotalDollars={(outstandingCents / 100).toFixed(2)}
          defaultStart={defaultStart}
        />
      </Card>
      <p className="mt-4 text-xs text-ink-faint">
        A plan is a tracked schedule + printable agreement. Record the actual payments on the
        Payments page as they come in. For a victim-survivor of domestic violence, stalking, or
        unlawful sexual behavior, Colorado allows a repayment plan of up to nine months — verify
        current law and consult your attorney.
      </p>
    </div>
  );
}
