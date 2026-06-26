import Link from "next/link";
import { Card, ButtonLink, Eyebrow } from "@/components/ui";
import { PageHeader, StatCard, StatusPill } from "@/components/dashboard-ui";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type LeaseRow = Tables<"leases"> & {
  units: { label: string; properties: { name: string | null } | null } | null;
};

type OccupancyRow = {
  rent_cents: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

/** Compute tenure from a start date to today as e.g. "1 yr 3 mo". */
function tenureLabel(startIso: string | null | undefined): string | undefined {
  if (!startIso) return undefined;
  const start = new Date(startIso);
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  parts.push(`${rem} mo`);
  return parts.join(" ");
}

export default async function PortalHome() {
  const { user, profile } = await requireProfile("/portal");
  const supabase = await createClient();

  const [{ data: occupancy }, { data: leases }, { data: maintenance }] = await Promise.all([
    supabase
      .from("unit_occupancy")
      .select("rent_cents, lease_start_date, lease_end_date, units(label, properties(name))")
      .eq("occupant_profile_id", user.id)
      .maybeSingle<OccupancyRow>(),
    supabase
      .from("leases")
      .select("*, units(label, properties(name))")
      .eq("resident_id", user.id)
      .order("start_date", { ascending: false })
      .returns<LeaseRow[]>(),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const activeLease = leases?.find((l) => l.status === "active") ?? leases?.[0] ?? null;

  // Resolve the resident's home primarily via unit_occupancy, falling back to
  // their active lease.
  const homeLabel = occupancy?.units?.label ?? activeLease?.units?.label ?? "—";
  const homeProperty =
    occupancy?.units?.properties?.name ?? activeLease?.units?.properties?.name ?? null;
  const rentCents = occupancy?.rent_cents ?? activeLease?.rent_cents ?? null;
  const tenure = tenureLabel(occupancy?.lease_start_date ?? activeLease?.start_date);

  const openCount =
    maintenance?.filter((m) => !["completed", "cancelled"].includes(m.status)).length ?? 0;

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const rulesAck =
    (profile as unknown as { house_rules_ack_at: string | null } | null)
      ?.house_rules_ack_at ?? null;

  const signedLease = leases?.find((l) => l.status === "active" && l.signed_at) ?? null;
  const pendingLease = leases?.find((l) => l.status === "pending_signature") ?? null;
  const hasHome = !!occupancy || !!activeLease;

  // Move-in check-in steps.
  const checkin = [
    { label: "Sign your lease", done: !pendingLease, href: "/portal/lease" },
    { label: "Read & acknowledge the house rules", done: !!rulesAck, href: "/portal/guide" },
    {
      label: "Add your renters insurance",
      done: !!(profile?.insurance_provider || profile?.insurance_doc_path),
      href: "/account",
    },
    {
      label: "Add an emergency contact",
      done: !!(profile?.emergency_contact_name || profile?.emergency_contact_phone),
      href: "/account",
    },
    { label: "Add your phone number", done: !!profile?.phone, href: "/account" },
  ];
  const checkinDone = checkin.filter((s) => s.done).length;
  const checkinComplete = checkinDone === checkin.length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's everything about your home in one place."
      />

      {hasHome && !checkinComplete && (
        <Card className="mb-8 border-pine/30 bg-pine/5 p-6">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-xl">🎉</span>
            <h3 className="font-display text-lg font-semibold text-ink">
              {signedLease ? `Welcome home, ${firstName}!` : `Welcome, ${firstName}!`}
            </h3>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {signedLease ? "Your lease is signed — l" : "L"}et&apos;s get you settled.
            A few quick things to finish your move-in check-in ({checkinDone}/
            {checkin.length} done).
          </p>
          <ul className="mt-4 space-y-2">
            {checkin.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-2.5">
                <span className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      s.done ? "bg-pine text-cream" : "border border-clay-deep text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className={s.done ? "text-ink-faint line-through" : "font-medium text-ink"}>
                    {s.label}
                  </span>
                </span>
                {!s.done && (
                  <Link href={s.href} className="text-sm font-medium text-pine hover:underline">
                    Do it →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasHome && checkinComplete && signedLease && (
        <Card className="mb-8 flex items-center gap-3 border-pine/30 bg-pine/5 p-5">
          <span aria-hidden className="text-xl">🏡</span>
          <p className="text-sm text-ink">
            <span className="font-semibold">You&apos;re all checked in — welcome home, {firstName}!</span>{" "}
            Everything about your home lives right here.
          </p>
        </Card>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Your home"
          value={homeLabel}
          hint={homeProperty ?? "No home on file yet"}
        />
        <StatCard
          label="Monthly rent"
          value={rentCents != null ? formatCents(rentCents) : "—"}
          tone="terracotta"
          hint={tenure ? `Tenure: ${tenure}` : rentCents != null ? "Due on the 1st" : undefined}
        />
        <StatCard
          label="Open requests"
          value={openCount}
          tone="gold"
          hint={openCount === 0 ? "All caught up" : "In progress"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <Eyebrow>Recent maintenance</Eyebrow>
            <Link href="/portal/maintenance" className="text-sm font-medium text-pine hover:text-pine-dark">
              View all
            </Link>
          </div>
          {maintenance && maintenance.length > 0 ? (
            <ul className="divide-y divide-clay">
              {maintenance.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{m.title}</div>
                    <div className="text-xs text-ink-faint">{formatDate(m.created_at)}</div>
                  </div>
                  <StatusPill value={m.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-6 text-center text-sm text-ink-soft">
              No requests yet.{" "}
              <Link href="/portal/maintenance" className="font-medium text-pine">
                Submit one →
              </Link>
            </div>
          )}
        </Card>

        <Card className="flex flex-col justify-between gap-4 p-6">
          <div>
            <Eyebrow>Need a hand?</Eyebrow>
            <h3 className="mt-2 font-display text-xl font-semibold text-ink">
              We&apos;re here for you
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              Submit a maintenance request, review your lease, or message the
              on-site team — we usually reply same day.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/portal/maintenance" variant="primary">
              New request
            </ButtonLink>
            <ButtonLink href="/portal/messages" variant="outline">
              Message us
            </ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}
