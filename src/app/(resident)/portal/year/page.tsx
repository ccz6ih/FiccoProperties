import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { getResidentPaymentInsights } from "@/lib/payment-insights";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "Your year in review" };

type OccRow = {
  move_in_date: string | null;
  lease_start_date: string | null;
  rent_cents: number | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

function monthsSince(startIso: string, now: Date): number {
  const start = new Date(startIso);
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function tenureLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  parts.push(`${rem} mo`);
  return parts.join(" ");
}

export default async function YearInReviewPage() {
  const { user, profile } = await requireProfile("/portal/year");
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const now = new Date();
  const year = now.getFullYear();

  const [{ data: occupancy }, { data: payments }, insights] = await Promise.all([
    supabase
      .from("unit_occupancy")
      .select("move_in_date, lease_start_date, rent_cents, units(label, properties(name))")
      .eq("occupant_profile_id", user.id)
      .maybeSingle<OccRow>(),
    db
      .from("payments")
      .select("amount_cents, created_at")
      .eq("resident_id", user.id)
      .eq("status", "succeeded")
      .returns<{ amount_cents: number; created_at: string }[]>(),
    getResidentPaymentInsights(db, user.id),
  ]);

  const home = occupancy?.units ?? null;
  const homeLabel = home
    ? `${home.properties?.name ? `${home.properties.name} · ` : ""}${home.label}`
    : null;

  const sinceIso = occupancy?.move_in_date ?? occupancy?.lease_start_date ?? null;
  const months = sinceIso ? monthsSince(sinceIso, now) : 0;
  const years = Math.floor(months / 12);

  const yearPayments = (payments ?? []).filter((p) => p.created_at?.slice(0, 4) === String(year));
  const yearPaidCents = yearPayments.reduce((s, p) => s + p.amount_cents, 0);
  const yearCount = yearPayments.length;

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const stats: { label: string; value: string; hint?: string }[] = [
    { label: "With us", value: sinceIso ? tenureLabel(months) : "—", hint: sinceIso ? `Since ${formatDate(sinceIso)}` : undefined },
    { label: `Paid in ${year}`, value: formatCents(yearPaidCents), hint: `${yearCount} payment${yearCount === 1 ? "" : "s"}` },
    { label: "On-time streak", value: `${insights.streak} mo`, hint: insights.streak >= 2 ? "Keep it going!" : "Every month counts" },
    { label: "Months paid", value: String(insights.monthsPaid), hint: "All time" },
  ];

  return (
    <main className="min-h-dvh bg-cream py-10 print:bg-white print:py-0">
      <Container className="max-w-3xl">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Link href="/portal/tenancy" className="text-sm font-medium text-pine hover:text-pine-dark">
            ← Back to your tenancy
          </Link>
          <PrintButton />
        </div>

        <div className="overflow-hidden rounded-2xl border border-clay bg-white print:rounded-none print:border-0">
          {/* Header */}
          <div className="bg-pine px-8 py-7 print:bg-pine" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
            <div className="font-display text-2xl font-semibold text-cream">38th Ave Properties</div>
            <div className="mt-0.5 text-sm text-cream/80">Your year in review · {year}</div>
          </div>

          <div className="p-8">
            <div className="text-3xl">🎉</div>
            <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
              Thank you, {firstName}!
            </h1>
            <p className="mt-2 max-w-xl text-ink-soft">
              {homeLabel ? `Here's a look back at your time at ${homeLabel}. ` : ""}
              We&apos;re so glad you call our community home — here&apos;s to a great year ahead.
            </p>

            {/* Stats */}
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-clay bg-sand/40 p-5"
                  style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                >
                  <div className="text-xs uppercase tracking-wide text-ink-faint">{s.label}</div>
                  <div className="mt-1 font-display text-2xl font-semibold text-pine">{s.value}</div>
                  {s.hint && <div className="text-xs text-ink-soft">{s.hint}</div>}
                </div>
              ))}
            </div>

            {years >= 1 && (
              <div className="mt-6 rounded-xl border border-pine/30 bg-pine/5 px-5 py-4">
                <div className="font-display text-lg font-semibold text-ink">
                  🏡 {years} year{years === 1 ? "" : "s"} and counting
                </div>
                <p className="mt-0.5 text-sm text-ink-soft">
                  Thank you for being part of our community year after year. It means the world to a
                  family-owned team like ours.
                </p>
              </div>
            )}

            <p className="mt-7 text-sm text-ink-soft">
              With gratitude,
              <br />
              <span className="font-medium text-ink">The 38th Ave Properties team</span>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint print:hidden">
          Questions? Message us anytime from your portal, or call (720) 527-2596.
        </p>
      </Container>
    </main>
  );
}
