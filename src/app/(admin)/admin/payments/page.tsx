import { Card } from "@/components/ui";
import { PageHeader, StatCard, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { PaymentsGenerateForm } from "@/components/payments-generate-form";
import { PaymentsRecordButton } from "@/components/payments-record-button";
import { formatCents, formatDate } from "@/lib/format";
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
};

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminPayments() {
  const supabase = await createClient();
  // New tables aren't in the generated types yet; read via a loose handle.
  const db = supabase as unknown as SupabaseClient;

  const { data: charges } = await db
    .from("charges")
    .select(
      "id, amount_cents, description, due_date, status, period, profiles:resident_id(full_name, email)"
    )
    .order("due_date", { ascending: false })
    .returns<ChargeRow[]>();

  const all = charges ?? [];
  const outstanding = all.filter((c) => c.status === "open" || c.status === "past_due");
  const outstandingCents = outstanding.reduce((s, c) => s + c.amount_cents, 0);
  const collectedCents = all
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amount_cents, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Payments"
        subtitle="Generate rent charges, track who's paid, and record offline payments."
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
        <PaymentsGenerateForm defaultPeriod={currentPeriod()} />
      </div>

      {all.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Resident</th>
                  <th className="px-5 py-3 font-medium">Charge</th>
                  <th className="px-5 py-3 font-medium">Period</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {all.map((c) => (
                  <tr key={c.id} className="hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">
                        {c.profiles?.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {c.profiles?.email ?? ""}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {c.description ?? "Rent"}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{c.period ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">{formatDate(c.due_date)}</td>
                    <td className="px-5 py-3 font-medium text-ink">
                      {formatCents(c.amount_cents)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill value={c.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.status === "open" || c.status === "past_due" ? (
                        <PaymentsRecordButton chargeId={c.id} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No charges yet"
          body="Generate this month's rent above to bill every active lease at once."
        />
      )}
    </div>
  );
}
