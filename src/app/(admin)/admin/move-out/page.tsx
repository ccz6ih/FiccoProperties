import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { formatDate } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Move-outs" };
export const dynamic = "force-dynamic";

type Row = {
  unit_id: string;
  tenant_name: string | null;
  notice_given_on: string | null;
  notice_move_out_on: string | null;
  notice_reason: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

/**
 * Which home is leaving?
 *
 * The move-out walk-through has always lived at /admin/move-out/<home>, which
 * you could only reach from the home itself — fine when you're already looking
 * at it, useless when someone has just rung to say they're going. This is the
 * way in: homes with notice already given at the top, everyone else below.
 */
export default async function MoveOuts() {
  const { profile } = await requireProfile("/admin/move-out");
  if (!isStaff(profile)) redirect("/portal");

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data } = await db
    .from("unit_occupancy")
    .select(
      "unit_id, tenant_name, notice_given_on, notice_move_out_on, notice_reason, units:unit_id(label, properties(name))"
    )
    .not("tenant_name", "is", null)
    .returns<Row[]>();

  const all = (data ?? []).map((r) => ({
    unitId: r.unit_id,
    home: r.units
      ? `${r.units.properties?.name ? `${r.units.properties.name} · ` : ""}${r.units.label}`
      : "—",
    tenantName: r.tenant_name,
    givenOn: r.notice_given_on,
    leavingOn: r.notice_move_out_on,
    reason: r.notice_reason,
  }));

  const noticed = all
    .filter((r) => r.leavingOn)
    .sort((a, b) => (a.leavingOn ?? "").localeCompare(b.leavingOn ?? ""));
  const settled = all
    .filter((r) => !r.leavingOn)
    .sort((a, b) => a.home.localeCompare(b.home));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Move-outs"
        subtitle="Record a notice to vacate, or walk through a home that's now empty."
      />

      {noticed.length > 0 && (
        <Card className="mb-6 overflow-hidden border-terracotta/30 p-0">
          <div className="border-b border-clay bg-terracotta/5 px-5 py-3.5">
            <h2 className="font-display text-lg font-semibold text-ink">Notice given</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Open the home to walk it through once the keys are back.
            </p>
          </div>
          <ul className="divide-y divide-clay">
            {noticed.map((r) => (
              <li key={r.unitId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <Link
                    href={`/admin/units/${r.unitId}`}
                    className="font-medium text-ink hover:text-pine hover:underline"
                  >
                    {r.home}
                  </Link>
                  <div className="text-xs text-ink-faint">
                    {r.tenantName}
                    {r.givenOn ? ` · told us ${formatDate(r.givenOn)}` : ""}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-terracotta-dark">
                      {r.leavingOn ? formatDate(r.leavingOn) : "—"}
                    </div>
                    <div className="text-[11px] text-ink-faint">leaving</div>
                  </div>
                  <Link
                    href={`/admin/move-out/${r.unitId}`}
                    className="rounded-full border border-clay-deep px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand"
                  >
                    Walk it through
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {settled.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-clay bg-sand/50 px-5 py-3.5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Someone else giving notice?
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Open their home and record it under &ldquo;Notice to vacate&rdquo;. It takes the
              date they told you and the date they&apos;ll be out.
            </p>
          </div>
          <ul className="divide-y divide-clay">
            {settled.map((r) => (
              <li key={r.unitId} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/units/${r.unitId}`}
                    className="font-medium text-ink hover:text-pine hover:underline"
                  >
                    {r.home}
                  </Link>
                  <div className="text-xs text-ink-faint">{r.tenantName}</div>
                </div>
                <Link
                  href={`/admin/units/${r.unitId}`}
                  className="shrink-0 text-xs font-medium text-pine hover:underline"
                >
                  Record a notice →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        noticed.length === 0 && (
          <EmptyState
            title="Nobody is leaving"
            body="When a resident gives notice, record it on their home and it will appear here."
          />
        )
      )}
    </div>
  );
}
