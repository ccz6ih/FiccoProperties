import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import { PageHeader, StatCard, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { PaymentsAddMethod } from "@/components/payments-add-method";
import { PaymentsPayButton } from "@/components/payments-pay-button";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { isStripeActive } from "@/lib/payments/provider";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type ChargeRow = {
  id: string;
  amount_cents: number;
  description: string | null;
  due_date: string | null;
  status: string;
  period: string | null;
};

type MethodRow = {
  id: string;
  kind: string;
  label: string | null;
  is_default: boolean;
};

type PaymentRow = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  provider_ref: string | null;
  receipt_note: string | null;
  receipt_path: string | null;
  charges: { description: string | null; period: string | null } | null;
};

type LedgerRow = { amount_cents: number };

const todayIso = () => new Date().toISOString().slice(0, 10);
function daysOverdue(due: string | null): number {
  if (!due || due >= todayIso()) return 0;
  return Math.floor((Date.now() - new Date(due).getTime()) / 86_400_000);
}

export default async function PortalPayments() {
  const { user } = await requireProfile("/portal/payments");
  const supabase = await createClient();
  // New tables aren't in the generated types yet; read via a loose handle.
  const db = supabase as unknown as SupabaseClient;

  const [{ data: charges }, { data: methods }, { data: payments }, { data: ledger }] =
    await Promise.all([
      db
        .from("charges")
        .select("id, amount_cents, description, due_date, status, period")
        .eq("resident_id", user.id)
        .order("due_date", { ascending: true })
        .returns<ChargeRow[]>(),
      db
        .from("payment_methods")
        .select("id, kind, label, is_default")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: true })
        .returns<MethodRow[]>(),
      db
        .from("payments")
        .select("id, amount_cents, status, created_at, provider_ref, receipt_note, receipt_path, charges(description, period)")
        .eq("resident_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<PaymentRow[]>(),
      db
        .from("ledger_entries")
        .select("amount_cents")
        .eq("resident_id", user.id)
        .returns<LedgerRow[]>(),
    ]);

  const balanceCents = (ledger ?? []).reduce((sum, r) => sum + r.amount_cents, 0);
  const openCharges = (charges ?? []).filter(
    (c) => c.status === "open" || c.status === "past_due"
  );
  const methodOptions = (methods ?? []).map((m) => ({
    id: m.id,
    label: m.label ?? (m.kind === "card" ? "Card" : "Bank account"),
  }));

  // Active repayment plan (if any) + its schedule.
  const { data: plan } = await db
    .from("repayment_plans")
    .select("id, total_cents, cadence, status")
    .eq("resident_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .maybeSingle<{ id: string; total_cents: number; cadence: string; status: string }>();
  let planItems: { seq: number; due_date: string; amount_cents: number; status: string }[] = [];
  if (plan) {
    const { data: pit } = await db
      .from("repayment_plan_items")
      .select("seq, due_date, amount_cents, status")
      .eq("plan_id", plan.id)
      .order("seq", { ascending: true })
      .returns<{ seq: number; due_date: string; amount_cents: number; status: string }[]>();
    planItems = pit ?? [];
  }
  const planPaid = planItems.filter((i) => i.status === "paid").length;
  const nextDue = planItems.find((i) => i.status !== "paid");

  // Online payments are OFF until a real processor is switched on — don't show
  // the pay/bank UI (the mock would otherwise mark charges paid without money).
  const payEnabled = isStripeActive();

  // Signed URLs for any receipt images attached to this resident's payments.
  const receiptUrls = new Map<string, string>();
  const withReceipt = (payments ?? []).filter((p) => p.receipt_path);
  if (withReceipt.length > 0) {
    const admin = createAdminClient();
    const signed = await Promise.all(
      withReceipt.map((p) => admin.storage.from("payment-receipts").createSignedUrl(p.receipt_path!, 3600))
    );
    withReceipt.forEach((p, i) => {
      const url = signed[i]?.data?.signedUrl;
      if (url) receiptUrls.set(p.id, url);
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Payments"
        subtitle={
          payEnabled
            ? "Pay rent, manage your bank accounts, and review your history."
            : "Review your charges, balance, and payment history."
        }
        action={
          <Link
            href="/statement"
            className="text-sm font-medium text-pine hover:text-pine-dark"
          >
            Rent statement →
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Current balance"
          value={formatCents(Math.max(balanceCents, 0))}
          tone={balanceCents > 0 ? "terracotta" : "pine"}
          hint={balanceCents > 0 ? "Amount due" : "You're all paid up"}
        />
        <StatCard
          label="Open charges"
          value={openCharges.length}
          tone="gold"
          hint={openCharges.length === 0 ? "Nothing outstanding" : "Awaiting payment"}
        />
        {payEnabled ? (
          <StatCard
            label="Bank accounts"
            value={methodOptions.length}
            hint={methodOptions.length === 0 ? "Add one below" : "Ready to pay"}
          />
        ) : (
          <StatCard label="Rent due" value="1st" hint="Of each month" />
        )}
      </div>

      {plan && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clay bg-sand/50 px-6 py-4">
            <div>
              <div className="font-display text-lg font-semibold text-ink">Repayment plan</div>
              <div className="text-sm text-ink-soft">
                {planPaid}/{planItems.length} payments made ·{" "}
                {nextDue ? `next ${formatCents(nextDue.amount_cents)} due ${formatDate(nextDue.due_date)}` : "all caught up"}
              </div>
            </div>
            <StatusPill value="active" />
          </div>
          <ul className="divide-y divide-clay">
            {planItems.map((i) => (
              <li key={i.seq} className="flex items-center justify-between px-6 py-2.5 text-sm">
                <span className="text-ink-soft">
                  #{i.seq} · {formatDate(i.due_date)}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-ink">{formatCents(i.amount_cents)}</span>
                  {i.status === "paid" ? (
                    <span className="text-xs font-medium text-pine">Paid</span>
                  ) : (
                    <span className="text-xs text-ink-faint">Due</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-6 py-3 text-xs text-ink-faint">
            These payments are for your past-due balance. Regular monthly rent is still due as usual.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-6">
            <Eyebrow>Open charges</Eyebrow>
            {openCharges.length > 0 ? (
              <ul className="mt-4 divide-y divide-clay">
                {openCharges.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <div className="font-medium text-ink">
                        {c.description ?? "Rent"}
                        {c.period ? ` — ${c.period}` : ""}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                        <StatusPill value={c.status} />
                        <span>Due {formatDate(c.due_date)}</span>
                        {daysOverdue(c.due_date) > 0 && (
                          <span className="rounded-full bg-terracotta-soft px-2 py-0.5 font-medium text-terracotta-dark">
                            {daysOverdue(c.due_date)} days overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-display text-lg font-semibold text-ink">
                        {formatCents(c.amount_cents)}
                      </span>
                      {payEnabled && (
                        <PaymentsPayButton
                          chargeId={c.id}
                          methods={methodOptions}
                          amountLabel={formatCents(c.amount_cents)}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center text-sm text-ink-soft">
                No open charges. You&apos;re all caught up.
              </div>
            )}
          </Card>

          <Card className="p-6">
            <Eyebrow>Payment history</Eyebrow>
            {payments && payments.length > 0 ? (
              <ul className="mt-4 divide-y divide-clay">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium text-ink">
                        {p.charges?.description ?? "Rent"}
                        {p.charges?.period ? ` — ${p.charges.period}` : ""}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {formatDate(p.created_at)}
                        {(() => {
                          const ref =
                            p.receipt_note ??
                            (p.provider_ref && p.provider_ref !== "offline" ? p.provider_ref : null);
                          return ref ? ` · ${ref}` : "";
                        })()}
                        {receiptUrls.get(p.id) && (
                          <>
                            {" · "}
                            <a
                              href={receiptUrls.get(p.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-pine hover:underline"
                            >
                              Receipt
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-ink">
                        {formatCents(p.amount_cents)}
                      </span>
                      <StatusPill value={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center text-sm text-ink-soft">
                No payments yet.
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {payEnabled ? (
            <>
              <PaymentsAddMethod />
              <Card className="p-6">
                <Eyebrow>Your bank accounts</Eyebrow>
                {methods && methods.length > 0 ? (
                  <ul className="mt-4 divide-y divide-clay">
                    {methods.map((m) => (
                      <li key={m.id} className="flex items-center justify-between py-3">
                        <div className="text-sm font-medium text-ink">
                          {m.label ?? (m.kind === "card" ? "Card" : "Bank account")}
                        </div>
                        {m.is_default && <StatusPill value="active" />}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="py-6 text-center text-sm text-ink-soft">
                    No bank accounts yet — add one to start paying rent.
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Card className="p-6">
              <Eyebrow>How to pay</Eyebrow>
              <p className="mt-3 text-sm text-ink-soft">
                Please pay by <span className="font-medium text-ink">check or money order</span> (write
                your unit number on it).
              </p>
              <div className="mt-3 rounded-xl border border-clay bg-sand/40 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Rent drop box
                </div>
                <div className="mt-0.5 text-sm font-medium text-ink">
                  11080 W 38th Ave, #7
                </div>
                <div className="text-sm text-ink-soft">Wheat Ridge, CO 80033</div>
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                Questions or to make arrangements, call{" "}
                <span className="font-medium text-ink">(720) 527-2596</span>.
              </p>
              <p className="mt-4 text-xs text-ink-faint">
                Online payments aren&apos;t available yet — we&apos;ll let you know when they are.
              </p>
            </Card>
          )}
        </div>
      </div>

      {(charges?.length ?? 0) === 0 && (methods?.length ?? 0) === 0 && (
        <div className="mt-8">
          <EmptyState
            title="Nothing here yet"
            body="Once your lease is active and rent is charged, you'll be able to pay it here."
          />
        </div>
      )}
    </div>
  );
}
