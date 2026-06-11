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

export default async function PortalHome() {
  const { user, profile } = await requireProfile("/portal");
  const supabase = await createClient();

  const [{ data: leases }, { data: maintenance }] = await Promise.all([
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
  const openCount =
    maintenance?.filter((m) => !["completed", "cancelled"].includes(m.status)).length ?? 0;

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's everything about your home in one place."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Your home"
          value={activeLease?.units?.label ?? "—"}
          hint={activeLease?.units?.properties?.name ?? "No active lease yet"}
        />
        <StatCard
          label="Monthly rent"
          value={activeLease ? formatCents(activeLease.rent_cents) : "—"}
          tone="terracotta"
          hint={activeLease ? "Due on the 1st" : undefined}
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
