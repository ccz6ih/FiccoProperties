import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lease" };

type LeaseRow = {
  id: string;
  resident_id: string;
  rent_cents: number;
  deposit_cents: number;
  start_date: string;
  end_date: string | null;
  status: string;
  terms: string | null;
  signature_name: string | null;
  signature_ip: string | null;
  signed_at: string | null;
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
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function LeasePrint({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { user } = await requireProfile("/lease-print");
  const { id } = await searchParams;
  if (!id) notFound();

  const supabase = await createClient();
  // RLS lets staff read any lease and a resident read their own.
  const { data: lease } = await supabase
    .from("leases")
    .select(
      "id, resident_id, rent_cents, deposit_cents, start_date, end_date, status, terms, signature_name, signature_ip, signed_at, units(label, properties(name, address_line1, city, state, postal_code)), profiles(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle<LeaseRow>();

  if (!lease) notFound();

  // Belt-and-suspenders: confirm staff or the lease's own resident.
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isStaffUser = !!me && ["owner", "admin"].includes(me.role);
  if (!isStaffUser && lease.resident_id !== user.id) redirect("/portal");

  const prop = lease.units?.properties;
  const address = [prop?.address_line1, prop?.city, prop?.state, prop?.postal_code]
    .filter(Boolean)
    .join(", ");
  const home = `${prop?.name ?? ""} · ${lease.units?.label ?? ""}`.trim();
  const backHref = isStaffUser ? `/admin/leases/${lease.id}` : "/portal/lease";

  return (
    <main className="min-h-dvh bg-cream py-10 print:bg-white print:py-0">
      <Container className="max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <Link href={backHref} className="text-sm font-medium text-pine hover:text-pine-dark">
            ← Back
          </Link>
          <PrintButton label="Print / Save as PDF" />
        </div>

        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          {/* Letterhead */}
          <div className="mb-6 flex items-start justify-between border-b border-clay pb-5">
            <div>
              <div className="font-display text-2xl font-semibold text-pine">
                38th Ave Properties
              </div>
              <div className="text-sm text-ink-soft">Residential Lease Agreement</div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-medium text-ink">{home}</div>
              {address && <div className="text-xs text-ink-faint">{address}</div>}
            </div>
          </div>

          {/* Summary */}
          <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Field label="Resident" value={lease.profiles?.full_name ?? "—"} />
            <Field label="Monthly rent" value={formatCents(lease.rent_cents)} />
            <Field label="Security deposit" value={formatCents(lease.deposit_cents)} />
            <Field label="Start date" value={formatDate(lease.start_date)} />
            <Field
              label="End date"
              value={lease.end_date ? formatDate(lease.end_date) : "Month-to-month"}
            />
            <Field label="Status" value={lease.status.replace("_", " ")} />
          </dl>

          {/* Terms */}
          <div className="whitespace-pre-wrap border-t border-clay pt-5 text-[13px] leading-relaxed text-ink">
            {lease.terms?.trim() || "No terms recorded on this lease."}
          </div>

          {/* Signature certificate */}
          <div className="mt-8 rounded-xl border border-clay bg-sand/30 p-5 text-sm print:bg-white">
            <h2 className="font-display text-base font-semibold text-ink">
              Electronic signature
            </h2>
            {lease.signed_at ? (
              <dl className="mt-2 space-y-1">
                <Row label="Signed by" value={lease.signature_name ?? "—"} />
                <Row
                  label="Date & time"
                  value={new Date(lease.signed_at).toLocaleString("en-US")}
                />
                <Row label="IP address" value={lease.signature_ip ?? "—"} />
                <Row label="Resident email" value={lease.profiles?.email ?? "—"} />
              </dl>
            ) : (
              <p className="mt-1 text-ink-soft">Not yet signed.</p>
            )}
            <p className="mt-3 text-xs text-ink-faint">
              This record certifies the lease was reviewed and signed electronically through
              the 38th Ave Properties resident portal.
            </p>
          </div>
        </div>
      </Container>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 font-medium capitalize text-ink">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
