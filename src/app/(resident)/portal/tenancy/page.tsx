import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import { PageHeader, StatCard } from "@/components/dashboard-ui";
import { formatCents, formatDate } from "@/lib/format";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type OccupancyRow = {
  rent_cents: number | null;
  move_in_date: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

type LeaseRow = {
  status: string;
  rent_cents: number | null;
  start_date: string | null;
  end_date: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

/** Whole months between a start date and now. */
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

/** The Nth anniversary date (N = completed years + 1) and days until it. */
function nextAnniversary(startIso: string, now: Date) {
  const start = new Date(startIso);
  const years = Math.floor(monthsSince(startIso, now) / 12);
  const next = new Date(start);
  next.setFullYear(start.getFullYear() + years + 1);
  const days = Math.ceil((next.getTime() - now.getTime()) / 86_400_000);
  return { year: years + 1, date: next, days };
}

const tools = [
  { href: "/portal/check-in", label: "Move-in check-in", hint: "Photos & disclosures" },
  { href: "/portal/move-out", label: "Move-out", hint: "Photos & deposit" },
  { href: "/portal/payments", label: "Pay rent", hint: "Charges & history" },
  { href: "/statement", label: "Rent statement", hint: "Printable ledger" },
  { href: "/portal/year", label: "Year in review", hint: "Your tenancy recap" },
  { href: "/portal/lease", label: "Your lease", hint: "Terms & documents" },
  { href: "/portal/renewal", label: "Lease renewal", hint: "Offers & responses" },
  { href: "/portal/maintenance", label: "Maintenance", hint: "Request a repair" },
  { href: "/portal/incident", label: "Report an incident", hint: "Safety & disputes" },
  { href: "/portal/messages", label: "Message us", hint: "On-site team" },
  { href: "/portal/notices", label: "Notices", hint: "From management" },
  { href: "/portal/community", label: "Community", hint: "Info & resources" },
  { href: "/account", label: "Account", hint: "Insurance & contacts" },
];

export default async function TenancyPage() {
  const { user, profile } = await requireProfile("/portal/tenancy");
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const now = new Date();

  const [{ data: occupancy }, { data: leases }, { data: payments }, { data: ledger }] =
    await Promise.all([
      supabase
        .from("unit_occupancy")
        .select(
          "rent_cents, move_in_date, lease_start_date, lease_end_date, units(label, properties(name))"
        )
        .eq("occupant_profile_id", user.id)
        .maybeSingle<OccupancyRow>(),
      supabase
        .from("leases")
        .select("status, rent_cents, start_date, end_date, units(label, properties(name))")
        .eq("resident_id", user.id)
        .order("start_date", { ascending: false })
        .returns<LeaseRow[]>(),
      db
        .from("payments")
        .select("amount_cents, status")
        .eq("resident_id", user.id)
        .eq("status", "succeeded")
        .returns<{ amount_cents: number }[]>(),
      db
        .from("ledger_entries")
        .select("amount_cents")
        .eq("resident_id", user.id)
        .returns<{ amount_cents: number }[]>(),
    ]);

  const activeLease =
    leases?.find((l) => l.status === "active") ?? leases?.[0] ?? null;

  const home = occupancy?.units ?? activeLease?.units ?? null;
  const homeLabel = home?.label ?? "—";
  const homeProperty = home?.properties?.name ?? null;
  const rentCents = occupancy?.rent_cents ?? activeLease?.rent_cents ?? null;

  const sinceIso =
    occupancy?.move_in_date ??
    occupancy?.lease_start_date ??
    activeLease?.start_date ??
    null;
  const leaseEnd = occupancy?.lease_end_date ?? activeLease?.end_date ?? null;
  const leaseStart = occupancy?.lease_start_date ?? activeLease?.start_date ?? null;

  const months = sinceIso ? monthsSince(sinceIso, now) : 0;
  const years = Math.floor(months / 12);
  const anniv = sinceIso ? nextAnniversary(sinceIso, now) : null;

  const paymentCount = payments?.length ?? 0;
  const lifetimePaidCents = (payments ?? []).reduce(
    (s, p) => s + p.amount_cents,
    0
  );
  const balanceCents = (ledger ?? []).reduce((s, r) => s + r.amount_cents, 0);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  // Milestones, newest meaningful first.
  const milestones: { date: string; label: string }[] = [];
  if (sinceIso) milestones.push({ date: sinceIso, label: "Moved in" });
  if (leaseStart && leaseStart !== sinceIso)
    milestones.push({ date: leaseStart, label: "Lease started" });
  if (sinceIso && years >= 1) {
    const start = new Date(sinceIso);
    const last = new Date(start);
    last.setFullYear(start.getFullYear() + years);
    milestones.push({
      date: last.toISOString().slice(0, 10),
      label: `${years}-year anniversary`,
    });
  }
  milestones.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Your tenancy"
        subtitle="Your history with us, milestones, and quick tools — all in one place."
      />

      {/* Milestone / anniversary banner */}
      <Card className="mb-8 overflow-hidden border-pine/30 bg-pine/5 p-6">
        {sinceIso ? (
          years >= 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-2xl">🎉</div>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
                  Celebrating {years} year{years === 1 ? "" : "s"}
                  {homeProperty ? ` at ${homeProperty}` : ""}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Thank you for being part of our community, {firstName} — a
                  resident since {formatDate(sinceIso)}.
                </p>
              </div>
              {anniv && anniv.days <= 45 && (
                <div className="rounded-xl border border-pine/30 bg-cream px-4 py-3 text-center">
                  <div className="text-xs text-ink-faint">Coming up</div>
                  <div className="font-display text-lg font-semibold text-pine">
                    {anniv.year}-year on {formatDate(anniv.date.toISOString())}
                  </div>
                  <div className="text-xs text-ink-soft">
                    in {anniv.days} day{anniv.days === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="text-2xl">🏡</div>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
                Welcome home, {firstName}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                You&apos;ve been with us {tenureLabel(months)} — resident since{" "}
                {formatDate(sinceIso)}. We&apos;re glad you&apos;re here.
              </p>
            </div>
          )
        ) : (
          <div>
            <div className="text-2xl">🏡</div>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
              Welcome, {firstName}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Once your move-in date is on file, your tenure and milestones will
              show up here.
            </p>
          </div>
        )}
      </Card>

      {/* At-a-glance */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Your home"
          value={homeLabel}
          hint={homeProperty ?? "No home on file"}
        />
        <StatCard
          label="Tenure"
          value={sinceIso ? tenureLabel(months) : "—"}
          tone="pine"
          hint={sinceIso ? `Since ${formatDate(sinceIso)}` : undefined}
        />
        <StatCard
          label="Payments made"
          value={paymentCount}
          tone="gold"
          hint={
            lifetimePaidCents > 0
              ? `${formatCents(lifetimePaidCents)} paid`
              : "No payments yet"
          }
        />
        <StatCard
          label="Standing"
          value={balanceCents > 0 ? formatCents(balanceCents) : "Paid up"}
          tone={balanceCents > 0 ? "terracotta" : "pine"}
          hint={balanceCents > 0 ? "Balance due" : "Nothing outstanding"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Milestones timeline */}
        <Card className="p-6">
          <Eyebrow>Milestones</Eyebrow>
          {milestones.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {milestones.map((m, i) => (
                <li key={i} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-pine" />
                    {i < milestones.length - 1 && (
                      <span className="mt-1 h-8 w-px bg-clay" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink">{m.label}</div>
                    <div className="text-xs text-ink-faint">
                      {formatDate(m.date)}
                    </div>
                  </div>
                </li>
              ))}
              {leaseEnd && (
                <li className="flex gap-3">
                  <div className="mt-1">
                    <span className="h-2.5 w-2.5 rounded-full border border-clay-deep bg-cream" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink-soft">
                      Lease renews / ends
                    </div>
                    <div className="text-xs text-ink-faint">
                      {formatDate(leaseEnd)}
                    </div>
                  </div>
                </li>
              )}
            </ul>
          ) : (
            <div className="py-6 text-center text-sm text-ink-soft">
              Your move-in and lease dates will appear here once they&apos;re on
              file.
            </div>
          )}
        </Card>

        {/* Tools launchpad */}
        <Card className="p-6">
          <Eyebrow>Useful tools</Eyebrow>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {tools.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="rounded-xl border border-clay p-3 transition-colors hover:border-pine/40 hover:bg-sand/40"
              >
                <div className="text-sm font-medium text-ink">{t.label}</div>
                <div className="text-xs text-ink-faint">{t.hint}</div>
              </Link>
            ))}
          </div>
          {rentCents != null && (
            <p className="mt-4 text-xs text-ink-faint">
              Your rent is {formatCents(rentCents)}, due on the 1st each month. Pay by check or money
              order made payable to <span className="font-medium text-ink">{RENT_DROPBOX.payee}</span>,
              in the rent drop box at {RENT_DROPBOX.line1}, {RENT_DROPBOX.city}.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
