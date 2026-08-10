import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, Eyebrow } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { RepaymentSignForm } from "@/components/repayment-sign-form";
import { TENANT_ATTESTATION } from "@/lib/repayment-esign";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";

type PlanRow = {
  id: string;
  total_cents: number;
  down_payment_cents: number;
  installments: number;
  cadence: string;
  status: string;
  notes: string | null;
  created_at: string;
  tenant_signed_name: string | null;
  tenant_signed_at: string | null;
  landlord_signed_name: string | null;
  landlord_signed_at: string | null;
};

const CADENCE: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  monthly: "Monthly",
};

function stamp(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default async function PortalRepayment() {
  const { user, profile } = await requireProfile("/portal/repayment");
  const db = createAdminClient() as unknown as SupabaseClient;

  const unitId = await getResidentUnitId(user.id);
  const { data: plan } = unitId
    ? await db
        .from("repayment_plans")
        .select(
          "id, total_cents, down_payment_cents, installments, cadence, status, notes, created_at, tenant_signed_name, tenant_signed_at, landlord_signed_name, landlord_signed_at"
        )
        .eq("unit_id", unitId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<PlanRow>()
    : { data: null };

  if (!plan) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Repayment plan" subtitle="Your rent repayment agreement lives here." />
        <EmptyState
          title="No repayment plan on file"
          body="If you've talked with us about a payment plan, it will appear here for you to review and sign."
        />
      </div>
    );
  }

  const { data: items } = await db
    .from("repayment_plan_items")
    .select("seq, due_date, amount_cents, status")
    .eq("plan_id", plan.id)
    .order("seq", { ascending: true })
    .returns<{ seq: number; due_date: string; amount_cents: number; status: string }[]>();
  const rows = items ?? [];
  const paidCount = rows.filter((r) => r.status === "paid").length;
  const financed = plan.total_cents - plan.down_payment_cents;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Your repayment plan"
        subtitle="The schedule we've agreed to for catching up — review it, sign it, and track your progress."
      />

      <Card className="p-6 sm:p-8">
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Past-due balance" value={formatCents(plan.total_cents)} />
          <Tile label="Down payment" value={formatCents(plan.down_payment_cents)} />
          <Tile label="Remaining" value={formatCents(financed)} />
          <Tile label="Schedule" value={`${plan.installments} · ${CADENCE[plan.cadence] ?? plan.cadence}`} />
        </div>

        <Eyebrow>Payment schedule</Eyebrow>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-clay text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">Due date</th>
              <th className="py-2 pr-3 text-right font-medium">Amount</th>
              <th className="py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seq} className="border-b border-clay/60">
                <td className="py-2 pr-3 text-ink-faint">{r.seq}</td>
                <td className="py-2 pr-3 text-ink">{formatDate(r.due_date)}</td>
                <td className="py-2 pr-3 text-right font-medium text-ink">{formatCents(r.amount_cents)}</td>
                <td className={`py-2 text-right text-xs font-medium ${r.status === "paid" ? "text-pine" : "text-ink-soft"}`}>
                  {r.status === "paid" ? "Paid ✓" : "Open"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-faint">
          {paidCount}/{rows.length} installments paid. Pay by check or money order made payable to{" "}
          <span className="font-medium text-ink-soft">{RENT_DROPBOX.payee}</span>, in the drop box at{" "}
          {RENT_DROPBOX.line1} (write your unit number on it). Your regular monthly rent stays due as
          usual — this schedule covers past-due rent only.
        </p>
        {plan.notes && <p className="mt-2 text-xs text-ink-faint">Note: {plan.notes}</p>}

        {/* Signatures */}
        <div className="mt-6 border-t border-clay pt-5">
          <Eyebrow>Signatures</Eyebrow>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-clay bg-sand/40 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-faint">Tenant</div>
              {plan.tenant_signed_at ? (
                <>
                  <div className="font-display text-lg italic text-ink">{plan.tenant_signed_name}</div>
                  <div className="text-xs text-pine">Signed {stamp(plan.tenant_signed_at)} ✓</div>
                </>
              ) : (
                <div className="text-sm text-ink-soft">Awaiting your signature below</div>
              )}
            </div>
            <div className="rounded-xl border border-clay bg-sand/40 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-ink-faint">Landlord — 38th Ave Properties</div>
              {plan.landlord_signed_at ? (
                <>
                  <div className="font-display text-lg italic text-ink">{plan.landlord_signed_name}</div>
                  <div className="text-xs text-pine">Signed {stamp(plan.landlord_signed_at)} ✓</div>
                </>
              ) : (
                <div className="text-sm text-ink-soft">Awaiting landlord countersignature</div>
              )}
            </div>
          </div>

          {!plan.tenant_signed_at && (
            <div className="mt-5">
              <RepaymentSignForm
                planId={plan.id}
                defaultName={profile?.full_name ?? ""}
                attestation={TENANT_ATTESTATION}
              />
            </div>
          )}
          {plan.tenant_signed_at && plan.landlord_signed_at && (
            <p className="mt-4 rounded-xl bg-pine/10 px-4 py-3 text-sm font-medium text-pine">
              Fully executed ✓ — both parties have signed. The official copy was emailed to you.
            </p>
          )}
        </div>
      </Card>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Questions or need to adjust a date?{" "}
        <Link href="/portal/messages" className="font-medium text-pine hover:text-pine-dark">
          Message us
        </Link>{" "}
        or call {RENT_DROPBOX.phone} — we&apos;d rather adjust the plan than see it break.
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-clay bg-sand/40 px-3 py-2.5 text-center">
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 font-display text-base font-semibold text-ink">{value}</div>
    </div>
  );
}
