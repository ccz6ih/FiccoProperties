import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { NOTICE_LABELS, type NoticeType } from "@/lib/notice-template";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tenant case file" };
export const dynamic = "force-dynamic";

type UnitRow = {
  id: string;
  label: string;
  status: string;
  properties: {
    name: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
  } | null;
};
type OccRow = {
  tenant_name: string | null;
  tenant_email: string | null;
  occupant_profile_id: string | null;
  rent_cents: number | null;
  move_in_date: string | null;
  assistance_programs: string[] | null;
  assistance_disclosed_at: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

const PROGRAM_LABEL: Record<string, string> = {
  ssi: "SSI",
  ssdi: "SSDI",
  colorado_works: "Colorado Works",
};
type LeaseRow = {
  rent_cents: number | null;
  deposit_cents: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  signed_at: string | null;
};
type ChargeRow = {
  id: string;
  amount_cents: number;
  description: string | null;
  due_date: string | null;
  status: string;
  period: string | null;
};
type PaymentRow = {
  charge_id: string | null;
  amount_cents: number;
  created_at: string;
  status: string;
  provider_ref: string | null;
};
type NoticeRow = {
  type: string;
  title: string;
  status: string;
  served_at: string | null;
  served_method: string | null;
  cure_by: string | null;
  created_at: string;
};

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}
function methodLabel(m: string | null): string {
  const map: Record<string, string> = {
    posted: "Posted", mailed: "Mailed", hand: "Hand-delivered", email: "Email", portal: "Portal",
  };
  return m ? map[m] ?? m : "—";
}

export default async function CaseFile({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { profile } = await requireProfile("/admin/payments");
  if (!isStaff(profile)) redirect("/portal");

  const { unitId } = await params;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const [{ data: unit }, { data: occ }, { data: lease }, { data: charges }, { data: notices }, { data: docRows }] =
    await Promise.all([
      db.from("units").select("id, label, status, properties(name, address_line1, city, state, postal_code)").eq("id", unitId).maybeSingle<UnitRow>(),
      db.from("unit_occupancy").select("tenant_name, tenant_email, occupant_profile_id, rent_cents, move_in_date, assistance_programs, assistance_disclosed_at, emergency_contact_name, emergency_contact_phone").eq("unit_id", unitId).maybeSingle<OccRow>(),
      db.from("leases").select("rent_cents, deposit_cents, start_date, end_date, status, signed_at").eq("unit_id", unitId).eq("status", "active").maybeSingle<LeaseRow>(),
      db.from("charges").select("id, amount_cents, description, due_date, status, period").eq("unit_id", unitId).neq("status", "void").order("due_date", { ascending: true }).returns<ChargeRow[]>(),
      db.from("notices").select("type, title, status, served_at, served_method, cure_by, created_at").eq("unit_id", unitId).order("created_at", { ascending: true }).returns<NoticeRow[]>(),
      db.from("lease_documents").select("id").eq("unit_id", unitId).returns<{ id: string }[]>(),
    ]);
  const leaseDocCount = docRows?.length ?? 0;

  if (!unit) redirect("/admin/delinquency");

  const allCharges = charges ?? [];
  const chargeIds = allCharges.map((c) => c.id);
  const paidByCharge = new Map<string, number>();
  const lastPay = new Map<string, PaymentRow>();
  if (chargeIds.length > 0) {
    const { data: pays } = await db
      .from("payments")
      .select("charge_id, amount_cents, created_at, status, provider_ref")
      .in("charge_id", chargeIds)
      .eq("status", "succeeded")
      .returns<PaymentRow[]>();
    for (const p of pays ?? []) {
      if (!p.charge_id) continue;
      paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_cents);
      const cur = lastPay.get(p.charge_id);
      if (!cur || p.created_at > cur.created_at) lastPay.set(p.charge_id, p);
    }
  }

  const isLateFee = (c: ChargeRow) => (c.description ?? "").toLowerCase().includes("late fee");
  const rows = allCharges.map((c) => {
    const paid = paidByCharge.get(c.id) ?? 0;
    const remaining = Math.max(0, c.amount_cents - paid);
    const pay = lastPay.get(c.id) ?? null;
    const paidLateDays = pay && c.due_date ? Math.max(0, daysBetween(c.due_date, pay.created_at.slice(0, 10))) : 0;
    const stateLabel =
      remaining <= 0 ? "Paid" : paid > 0 ? "Partial" : c.due_date && c.due_date < todayIso ? "Late" : "Open";
    return { c, paid, remaining, pay, paidLateDays, stateLabel };
  });

  const pastDueRentCents = rows.filter((r) => !isLateFee(r.c)).reduce((s, r) => s + r.remaining, 0);
  const lateFeesCents = rows.filter((r) => isLateFee(r.c)).reduce((s, r) => s + r.remaining, 0);
  const totalOwed = pastDueRentCents + lateFeesCents;
  const missedRentDates = rows
    .filter((r) => !isLateFee(r.c) && r.remaining > 0 && r.c.due_date)
    .map((r) => formatDate(r.c.due_date))
    .join(", ");
  const paidLateCount = rows.filter((r) => r.stateLabel === "Paid" && r.paidLateDays > 10).length;
  const monthlyRentCents = lease?.rent_cents || occ?.rent_cents || 0;
  const dailyAccrualCents = monthlyRentCents ? Math.round(monthlyRentCents / 30) : 0;

  const servedNotices = (notices ?? []).filter((n) => n.served_at);
  const servedDemands = servedNotices.filter((n) => n.type === "pay_or_quit");
  const lastServed = servedNotices[servedNotices.length - 1] ?? null;

  const p = unit.properties;
  const fullAddress = [p?.address_line1, unit.label].filter(Boolean).join(", ");
  const cityLine = [p?.city, p?.state, p?.postal_code].filter(Boolean).join(", ");
  const tenant = occ?.tenant_name ?? "—";
  const reportDate = today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main
      className="min-h-dvh bg-cream py-10 print:bg-white print:py-0"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
    >
      <Container className="max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <Link href="/admin/delinquency" className="text-sm font-medium text-pine hover:text-pine-dark">
            ← Back to delinquency
          </Link>
          <PrintButton label="Print / Save as PDF" />
        </div>

        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          {/* Letterhead */}
          <div className="mb-6 flex items-start justify-between border-b border-clay pb-5">
            <div>
              <div className="font-display text-2xl font-semibold text-pine">38th Ave Properties</div>
              <div className="text-sm text-ink-soft">W 38th Ave, Wheat Ridge, CO 80033</div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-display text-lg font-semibold text-ink">Tenant case file</div>
              <div className="text-xs text-ink-faint">Prepared {reportDate}</div>
            </div>
          </div>

          {/* Tenant & premises */}
          <div className="mb-6 grid gap-px overflow-hidden rounded-xl border border-clay bg-clay sm:grid-cols-2">
            <Field label="Tenant" value={tenant} />
            <Field label="Home" value={`${p?.name ?? ""} · ${unit.label}`} />
            <Field label="Premises" value={[fullAddress, cityLine].filter(Boolean).join(" · ")} />
            <Field label="County" value="Jefferson" />
            <Field label="Move-in" value={occ?.move_in_date ? formatDate(occ.move_in_date) : "—"} />
            <Field
              label="Tenancy"
              value={lease ? "Written lease (active)" : occ?.tenant_name ? "Record-only / month-to-month" : "—"}
            />
          </div>

          {/* Mediation eligibility + contact */}
          {(() => {
            const programs = (occ?.assistance_programs ?? []).filter((x) => x);
            const contact = [occ?.emergency_contact_name, occ?.emergency_contact_phone].filter(Boolean).join(" · ");
            if (programs.length === 0 && !contact) return null;
            return (
              <div className="mb-6 break-inside-avoid rounded-xl border border-clay bg-sand/40 px-5 py-4">
                <h3 className="mb-2 font-display text-sm font-semibold text-ink">Mediation &amp; contact</h3>
                {programs.length > 0 ? (
                  <p className="mb-1 text-sm">
                    <span className="font-semibold text-terracotta-dark">⚠ Mandatory mediation likely required before filing</span>{" "}
                    <span className="text-ink-soft">
                      — tenant discloses {programs.map((p) => PROGRAM_LABEL[p] ?? p).join(", ")}
                      {occ?.assistance_disclosed_at ? ` (disclosed ${formatDate(occ.assistance_disclosed_at)})` : ""}. Schedule at www.ColoradoODR.org before filing (C.R.S. § 13-40-106(2)).
                    </span>
                  </p>
                ) : (
                  <p className="mb-1 text-sm text-ink-soft">No assistance program disclosed.</p>
                )}
                {contact && (
                  <p className="text-sm text-ink-soft">
                    <span className="font-medium text-ink">Best / emergency contact:</span> {contact}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Amounts — maps to JDF 101 Complaint fields */}
          <h2 className="mb-2 font-display text-base font-semibold text-ink">Amounts owed (as of {reportDate})</h2>
          <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-clay bg-clay sm:grid-cols-4">
            <Stat label="Past-due rent" value={formatCents(pastDueRentCents)} tone="terracotta" />
            <Stat label="Late fees" value={formatCents(lateFeesCents)} />
            <Stat label="Total owed" value={formatCents(totalOwed)} tone="terracotta" />
            <Stat label="Daily accrual" value={`${formatCents(dailyAccrualCents)}/day`} />
          </div>
          {missedRentDates && (
            <p className="mb-6 text-sm text-ink-soft">
              <span className="font-medium text-ink">Missed rent due dates:</span> {missedRentDates}
            </p>
          )}

          {/* Notices served */}
          <h2 className="mb-2 font-display text-base font-semibold text-ink">Notices served</h2>
          {servedNotices.length > 0 ? (
            <table className="mb-6 w-full text-sm">
              <thead>
                <tr className="border-b border-clay text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="py-1.5 pr-3 font-medium">Notice</th>
                  <th className="py-1.5 pr-3 font-medium">Served</th>
                  <th className="py-1.5 pr-3 font-medium">Method</th>
                  <th className="py-1.5 font-medium">Cure / move-out</th>
                </tr>
              </thead>
              <tbody>
                {servedNotices.map((n, i) => (
                  <tr key={i} className="border-b border-clay/60 break-inside-avoid">
                    <td className="py-1.5 pr-3 text-ink">{NOTICE_LABELS[n.type as NoticeType] ?? n.type}</td>
                    <td className="py-1.5 pr-3 text-ink-soft">{n.served_at ? formatDate(n.served_at) : "—"}</td>
                    <td className="py-1.5 pr-3 text-ink-soft">{methodLabel(n.served_method)}</td>
                    <td className="py-1.5 text-ink-soft">{n.cure_by ? formatDate(n.cure_by) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mb-6 text-sm text-ink-faint">No notices served yet.</p>
          )}

          {/* Ledger */}
          <h2 className="mb-2 font-display text-base font-semibold text-ink">Rent ledger — charges &amp; payments</h2>
          {rows.length > 0 ? (
            <table className="mb-6 w-full text-sm">
              <thead>
                <tr className="border-b border-clay text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="py-1.5 pr-3 font-medium">Due</th>
                  <th className="py-1.5 pr-3 font-medium">Charge</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Amount</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Paid</th>
                  <th className="py-1.5 pr-3 font-medium">Paid on / ref</th>
                  <th className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-clay/60 break-inside-avoid">
                    <td className="py-1.5 pr-3 text-ink-soft">{formatDate(r.c.due_date)}</td>
                    <td className="py-1.5 pr-3 text-ink">
                      {r.c.description ?? "Rent"}
                      {r.c.period ? <span className="text-ink-faint"> · {r.c.period}</span> : null}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-ink">{formatCents(r.c.amount_cents)}</td>
                    <td className="py-1.5 pr-3 text-right text-pine">{r.paid > 0 ? formatCents(r.paid) : "—"}</td>
                    <td className="py-1.5 pr-3 text-ink-soft">
                      {r.pay ? (
                        <>
                          {formatDate(r.pay.created_at)}
                          {r.pay.provider_ref && r.pay.provider_ref !== "offline" ? (
                            <span className="text-ink-faint"> · {r.pay.provider_ref}</span>
                          ) : null}
                          {r.paidLateDays > 0 ? (
                            <span className="text-terracotta-dark"> · {r.paidLateDays}d late</span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5">
                      {r.stateLabel === "Paid" ? (
                        <span className="font-medium text-pine">Paid</span>
                      ) : r.stateLabel === "Partial" ? (
                        <span className="font-semibold text-gold">Partial</span>
                      ) : r.stateLabel === "Late" ? (
                        <span className="font-semibold text-terracotta-dark">Late</span>
                      ) : (
                        <span className="text-ink-soft">Open</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mb-6 text-sm text-ink-faint">No charges on record.</p>
          )}

          {/* Documents on hand */}
          <div className="mb-6 break-inside-avoid rounded-xl border border-clay bg-sand/40 px-5 py-4">
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">
              For a court filing / document request (JDF 108)
            </h3>
            <ul className="space-y-1 text-sm text-ink-soft">
              <li>• Rent ledger &amp; payment history — <span className="font-medium text-ink">included above</span></li>
              <li>• Signed lease — <span className="font-medium text-ink">{leaseDocCount > 0 ? `${leaseDocCount} scanned on file` : lease ? "e-lease on file" : "not on file"}</span></li>
              <li>• Notices served — <span className="font-medium text-ink">{servedNotices.length} on record</span></li>
              <li>• Demands for Compliance served (JDF 99A) — <span className="font-medium text-ink">{servedDemands.length}</span>{paidLateCount > 0 ? `, ${paidLateCount} payment(s) paid 10+ days late` : ""}</li>
              {lastServed && (
                <li>• Most recent notice served — <span className="font-medium text-ink">{NOTICE_LABELS[lastServed.type as NoticeType] ?? lastServed.type} on {formatDate(lastServed.served_at)} ({methodLabel(lastServed.served_method)})</span></li>
              )}
            </ul>
          </div>

          <p className="text-xs text-ink-faint">
            This case file summarizes the records on file for the tenancy above and is a workflow aid, not
            legal advice. For an eviction, use Colorado&apos;s official JDF forms (Complaint JDF 101, Summons
            JDF 102, Affidavit of Service JDF 98) and consult your attorney. Mandatory mediation may apply if
            the tenant receives SSI, SSDI, or Colorado Works.
          </p>
        </div>
      </Container>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{value}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "terracotta" }) {
  const color = tone === "terracotta" ? "text-terracotta-dark" : "text-ink";
  return (
    <div className="bg-white p-4 text-center">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-0.5 font-display text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
