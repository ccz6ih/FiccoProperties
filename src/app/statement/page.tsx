import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rent statement" };

type LedgerRow = {
  kind: string;
  amount_cents: number;
  memo: string | null;
  created_at: string;
};

type HomeRow = {
  units: {
    label: string;
    properties: {
      name: string | null;
      address_line1: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
    } | null;
  } | null;
};

export default async function StatementPage() {
  const { user, profile } = await requireProfile("/statement");
  const supabase = await createClient();

  const [{ data: occupancy }, { data: ledger }] = await Promise.all([
    supabase
      .from("unit_occupancy")
      .select(
        "units(label, properties(name, address_line1, city, state, postal_code))"
      )
      .eq("occupant_profile_id", user.id)
      .maybeSingle<HomeRow>(),
    supabase
      .from("ledger_entries")
      .select("kind, amount_cents, memo, created_at")
      .eq("resident_id", user.id)
      .order("created_at", { ascending: true })
      .returns<LedgerRow[]>(),
  ]);

  const entries = ledger ?? [];
  // Running balance: charges add (+), payments subtract (−). Stored that way.
  let running = 0;
  const rows = entries.map((e) => {
    running += e.amount_cents;
    const isPayment = e.amount_cents < 0;
    return {
      date: e.created_at,
      desc: e.memo ?? (e.kind === "payment" ? "Payment" : "Charge"),
      charge: isPayment ? null : e.amount_cents,
      payment: isPayment ? -e.amount_cents : null,
      balance: running,
    };
  });

  const totalCharged = entries
    .filter((e) => e.amount_cents > 0)
    .reduce((s, e) => s + e.amount_cents, 0);
  const totalPaid = entries
    .filter((e) => e.amount_cents < 0)
    .reduce((s, e) => s - e.amount_cents, 0);

  const unit = occupancy?.units;
  const prop = unit?.properties;
  const address = [prop?.address_line1, prop?.city, prop?.state, prop?.postal_code]
    .filter(Boolean)
    .join(", ");

  // Stable statement date without Date.now() flakiness in render.
  const today = new Date();
  const statementDate = today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-dvh bg-cream py-10 print:bg-white print:py-0">
      <Container className="max-w-3xl">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Link
            href="/portal/payments"
            className="text-sm font-medium text-pine hover:text-pine-dark"
          >
            ← Back to payments
          </Link>
          <PrintButton />
        </div>

        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          {/* Letterhead */}
          <div className="mb-6 flex items-start justify-between border-b border-clay pb-5">
            <div>
              <div className="font-display text-2xl font-semibold text-pine">
                38th Ave Properties
              </div>
              <div className="text-sm text-ink-soft">W 38th Ave, Wheat Ridge, CO 80033</div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-display text-lg font-semibold text-ink">
                Rent statement
              </div>
              <div>{statementDate}</div>
            </div>
          </div>

          {/* Resident + unit */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-faint">Resident</div>
              <div className="font-medium text-ink">{profile?.full_name ?? "—"}</div>
              <div className="text-sm text-ink-soft">{user.email}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-faint">Home</div>
              <div className="font-medium text-ink">
                {prop?.name ? `${prop.name} · ${unit?.label}` : "—"}
              </div>
              {address && <div className="text-sm text-ink-soft">{address}</div>}
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-clay bg-clay">
            <Summary label="Total charged" value={formatCents(totalCharged)} />
            <Summary label="Total paid" value={formatCents(totalPaid)} />
            <Summary
              label="Current balance"
              value={formatCents(Math.max(running, 0))}
            />
          </div>

          {/* Ledger */}
          {rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 text-right font-medium">Charge</th>
                  <th className="py-2 pr-3 text-right font-medium">Payment</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-clay/60">
                    <td className="py-2 pr-3 text-ink-soft">{formatDate(r.date)}</td>
                    <td className="py-2 pr-3 text-ink">{r.desc}</td>
                    <td className="py-2 pr-3 text-right text-ink-soft">
                      {r.charge != null ? formatCents(r.charge) : ""}
                    </td>
                    <td className="py-2 pr-3 text-right text-pine">
                      {r.payment != null ? formatCents(r.payment) : ""}
                    </td>
                    <td className="py-2 text-right font-medium text-ink">
                      {formatCents(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-ink-soft">
              No rent activity yet. Charges and payments will appear here.
            </p>
          )}

          <p className="mt-6 text-xs text-ink-faint">
            This statement reflects rent charges and recorded payments as of{" "}
            {statementDate}. Questions? Contact the on-site team.
          </p>
        </div>
      </Container>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 text-center">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="mt-0.5 font-display text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}
