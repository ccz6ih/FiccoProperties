import Link from "next/link";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { PaymentsGenerateForm } from "@/components/payments-generate-form";
import { PaymentsTable, type PaymentRow } from "@/components/payments-table";
import { formatCents } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type ChargeRow = {
  id: string;
  amount_cents: number;
  description: string | null;
  due_date: string | null;
  status: string;
  period: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  units: {
    label: string;
    properties: { name: string | null } | null;
    unit_occupancy: { tenant_name: string | null; tenant_email: string | null }[] | null;
  } | null;
};

type PropertyRow = { id: string; name: string | null };

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminPayments() {
  const supabase = await createClient();
  // New tables aren't in the generated types yet; read via a loose handle.
  const db = supabase as unknown as SupabaseClient;

  const [{ data: charges }, { data: propertyList }] = await Promise.all([
    db
      .from("charges")
      .select(
        "id, amount_cents, description, due_date, status, period, profiles:resident_id(full_name, email), units:unit_id(label, properties(name), unit_occupancy(tenant_name, tenant_email))"
      )
      .order("due_date", { ascending: false })
      .returns<ChargeRow[]>(),
    db
      .from("properties")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<PropertyRow[]>(),
  ]);

  const properties = (propertyList ?? [])
    .filter((p): p is { id: string; name: string } => !!p.name)
    .map((p) => ({ id: p.id, name: p.name }));

  const all = charges ?? [];
  const outstanding = all.filter((c) => c.status === "open" || c.status === "past_due");
  const outstandingCents = outstanding.reduce((s, c) => s + c.amount_cents, 0);
  const collectedCents = all
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amount_cents, 0);

  const rows: PaymentRow[] = all.map((c) => {
    const occ = c.units?.unit_occupancy?.[0] ?? null;
    return {
      id: c.id,
      residentName:
        c.profiles?.full_name ??
        occ?.tenant_name ??
        (c.units?.label ? `${c.units.label}` : null),
      residentEmail: c.profiles?.email ?? occ?.tenant_email ?? null,
      property: c.units?.properties?.name ?? null,
      description: c.description,
      period: c.period,
      dueDate: c.due_date,
      amountCents: c.amount_cents,
      status: c.status,
    };
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Payments"
        subtitle="Generate rent charges, track who's paid, and record offline payments."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/rents"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Set rents →
            </Link>
            <Link
              href="/admin/rent-board"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Rent board →
            </Link>
            <Link
              href="/admin/payments-log"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Payments log →
            </Link>
            <Link
              href="/owner-report"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Owner report →
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={formatCents(outstandingCents)}
          tone="terracotta"
          hint={`${outstanding.length} unpaid charge${outstanding.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Collected"
          value={formatCents(collectedCents)}
          tone="pine"
          hint="Across all paid charges"
        />
        <StatCard
          label="Total charges"
          value={all.length}
          tone="gold"
          hint="All time"
        />
      </div>

      <div className="mb-8">
        <PaymentsGenerateForm defaultPeriod={currentPeriod()} properties={properties} />
      </div>

      {all.length > 0 ? (
        <PaymentsTable charges={rows} />
      ) : (
        <EmptyState
          title="No charges yet"
          body="Generate this month's rent above to bill every active lease at once."
        />
      )}
    </div>
  );
}
