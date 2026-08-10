import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ActionFeedbackButton } from "@/components/action-feedback-button";
import { formatCents, formatDate } from "@/lib/format";
import { CADENCE_LABEL, type Cadence } from "@/lib/repayment";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toggleInstallment, setPlanStatus, emailRepaymentPlan } from "@/app/(admin)/admin/repayment-plans/actions";

export const metadata: Metadata = { title: "Repayment plan" };
export const dynamic = "force-dynamic";

type PlanRow = {
  id: string;
  unit_id: string | null;
  total_cents: number;
  down_payment_cents: number;
  installments: number;
  cadence: string;
  start_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  units: {
    label: string;
    properties: { name: string | null; address_line1: string | null; city: string | null; state: string | null } | null;
  } | null;
};
type ItemRow = { id: string; seq: number; due_date: string; amount_cents: number; status: string; paid_at: string | null };

export default async function RepaymentPlanDetail({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) redirect("/portal");

  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: plan }, { data: items }] = await Promise.all([
    db
      .from("repayment_plans")
      .select("id, unit_id, total_cents, down_payment_cents, installments, cadence, start_date, status, notes, created_at, units:unit_id(label, properties(name, address_line1, city, state))")
      .eq("id", id)
      .maybeSingle<PlanRow>(),
    db.from("repayment_plan_items").select("id, seq, due_date, amount_cents, status, paid_at").eq("plan_id", id).order("seq", { ascending: true }).returns<ItemRow[]>(),
  ]);

  if (!plan) redirect("/admin/repayment-plans");

  const rows = items ?? [];
  // Occupancy fetched separately — the nested embed under units comes back empty.
  const { data: occ } = plan.unit_id
    ? await db
        .from("unit_occupancy")
        .select("tenant_name")
        .eq("unit_id", plan.unit_id)
        .maybeSingle<{ tenant_name: string | null }>()
    : { data: null };
  const tenant = occ?.tenant_name ?? "Resident";
  const p = plan.units?.properties;
  const home = `${p?.name ?? ""} · ${plan.units?.label ?? ""}`;
  const premises = [p?.address_line1, plan.units?.label, p?.city, p?.state].filter(Boolean).join(", ");
  const cadence = CADENCE_LABEL[(plan.cadence as Cadence)] ?? plan.cadence;

  const paidCount = rows.filter((r) => r.status === "paid").length;
  const paidCents = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount_cents, 0);
  const scheduledCents = rows.reduce((s, r) => s + r.amount_cents, 0);
  const remainingCents = plan.total_cents - plan.down_payment_cents - paidCents;
  const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main
      className="min-h-dvh bg-cream py-10 print:bg-white print:py-0"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
    >
      <Container className="max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/admin/repayment-plans" className="text-sm font-medium text-pine hover:text-pine-dark">
            ← All plans
          </Link>
          <div className="flex items-center gap-2">
            {plan.status !== "cancelled" ? (
              <form action={setPlanStatus}>
                <input type="hidden" name="plan_id" value={plan.id} />
                <input type="hidden" name="status" value="cancelled" />
                <button className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand">Cancel plan</button>
              </form>
            ) : (
              <form action={setPlanStatus}>
                <input type="hidden" name="plan_id" value={plan.id} />
                <input type="hidden" name="status" value="active" />
                <button className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand">Reactivate</button>
              </form>
            )}
            <ActionFeedbackButton
              action={emailRepaymentPlan}
              hidden={<input type="hidden" name="plan_id" value={plan.id} />}
              label="Email to tenant"
              successLabel="Emailed"
              sendingLabel="Sending…"
              compact
            />
            <PrintButton label="Print agreement" />
          </div>
        </div>

        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          {/* Letterhead */}
          <div className="mb-6 flex items-start justify-between border-b border-clay pb-5">
            <div>
              <div className="font-display text-2xl font-semibold text-pine">38th Ave Properties</div>
              <div className="text-sm text-ink-soft">W 38th Ave, Wheat Ridge, CO 80033</div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-display text-lg font-semibold text-ink">Rent Repayment Agreement</div>
              <div className="text-xs text-ink-faint">Prepared {reportDate}</div>
              <div className="mt-1">
                <StatusPill status={plan.status} />
              </div>
            </div>
          </div>

          {/* Parties + terms */}
          <p className="mb-4 text-sm leading-relaxed text-ink-soft">
            This Rent Repayment Agreement is made between <span className="font-medium text-ink">38th Ave Properties</span> (&ldquo;Landlord&rdquo;)
            and <span className="font-medium text-ink">{tenant}</span> (&ldquo;Tenant&rdquo;) for the premises at{" "}
            <span className="font-medium text-ink">{premises}</span>. The Tenant owes past-due rent, and the parties agree to the
            repayment schedule below.
          </p>

          <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-clay bg-clay sm:grid-cols-4">
            <Cell label="Past-due balance" value={formatCents(plan.total_cents)} />
            <Cell label="Down payment" value={formatCents(plan.down_payment_cents)} />
            <Cell label="Financed" value={formatCents(plan.total_cents - plan.down_payment_cents)} />
            <Cell label="Schedule" value={`${plan.installments} · ${cadence}`} />
          </div>

          {/* Schedule */}
          <h2 className="mb-2 font-display text-base font-semibold text-ink">Payment schedule</h2>
          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="border-b border-clay text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="py-1.5 pr-3 font-medium">#</th>
                <th className="py-1.5 pr-3 font-medium">Due date</th>
                <th className="py-1.5 pr-3 text-right font-medium">Amount</th>
                <th className="py-1.5 pr-3 font-medium">Status</th>
                <th className="py-1.5 font-medium print:hidden" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-clay/60 break-inside-avoid">
                  <td className="py-1.5 pr-3 text-ink-soft">{r.seq}</td>
                  <td className="py-1.5 pr-3 text-ink">{formatDate(r.due_date)}</td>
                  <td className="py-1.5 pr-3 text-right font-medium text-ink">{formatCents(r.amount_cents)}</td>
                  <td className="py-1.5 pr-3">
                    {r.status === "paid" ? (
                      <span className="font-medium text-pine">Paid{r.paid_at ? ` · ${formatDate(r.paid_at)}` : ""}</span>
                    ) : (
                      <span className="text-ink-soft">Open</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right print:hidden">
                    <form action={toggleInstallment}>
                      <input type="hidden" name="item_id" value={r.id} />
                      <input type="hidden" name="plan_id" value={plan.id} />
                      <input type="hidden" name="paid" value={r.status === "paid" ? "0" : "1"} />
                      <button className="text-xs font-medium text-pine hover:underline">
                        {r.status === "paid" ? "Undo" : "Mark paid"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-ink">
                <td className="py-1.5 pr-3" colSpan={2}>Scheduled total</td>
                <td className="py-1.5 pr-3 text-right">{formatCents(scheduledCents)}</td>
                <td className="py-1.5 pr-3 text-pine">{formatCents(paidCents)} paid</td>
                <td className="print:hidden" />
              </tr>
            </tfoot>
          </table>

          <div className="mb-6 text-sm text-ink-soft print:hidden">
            {paidCount}/{rows.length} installments paid · {formatCents(Math.max(0, remainingCents))} remaining
          </div>

          {/* Terms */}
          <div className="mb-6 break-inside-avoid rounded-xl border border-clay bg-sand/30 px-5 py-4 text-sm text-ink-soft">
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">Terms</h3>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>These payments are for <span className="font-medium text-ink">past-due rent only</span>. Ongoing monthly rent remains due in full on its normal date, in addition to this schedule.</li>
              <li>Payments should be made in certified funds (check, money order, or the online portal). Each payment will be applied to the oldest balance first.</li>
              <li>If a scheduled payment is missed, the Landlord may declare this agreement void and pursue all remedies for the full remaining balance as allowed by law.</li>
              <li>This agreement does not waive the Landlord&apos;s rights or the Tenant&apos;s rights under Colorado law, including any right to mediation.</li>
              {plan.notes ? <li><span className="font-medium text-ink">Note:</span> {plan.notes}</li> : null}
            </ol>
          </div>

          {/* Signatures */}
          <div className="grid gap-8 sm:grid-cols-2">
            <SignLine role="Tenant" name={tenant} />
            <SignLine role="Landlord — 38th Ave Properties" />
          </div>

          <p className="mt-6 text-xs text-ink-faint">
            Workflow aid, not legal advice. For a victim-survivor of domestic violence, stalking, or unlawful
            sexual behavior, Colorado permits a repayment plan of up to nine months. Verify current law and
            consult your attorney.
          </p>
        </div>
      </Container>
    </main>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 text-center">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="mt-0.5 font-display text-base font-semibold text-ink">{value}</div>
    </div>
  );
}

function SignLine({ role, name }: { role: string; name?: string }) {
  return (
    <div>
      <div className="h-10 border-b border-ink" />
      <div className="mt-1 text-xs text-ink-faint">{role}{name ? ` · ${name}` : ""}</div>
      <div className="mt-3 h-8 border-b border-ink" />
      <div className="mt-1 text-xs text-ink-faint">Date</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-gold/15 text-gold",
    completed: "bg-pine/10 text-pine",
    cancelled: "bg-clay text-ink-faint",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] ?? "bg-sand text-ink-soft"}`}>
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}
