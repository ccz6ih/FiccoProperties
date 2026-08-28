import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { formatDate } from "@/lib/format";
import { annivInfo } from "@/lib/anniversary";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAnniversaryCongrats } from "./actions";

type OccRow = {
  unit_id: string;
  occupant_profile_id: string | null;
  move_in_date: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function AdminAnniversaries() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const today = new Date();
  const year = today.getFullYear();

  const [{ data: occ }, { data: emailed }] = await Promise.all([
    db
      .from("unit_occupancy")
      .select(
        "unit_id, occupant_profile_id, move_in_date, tenant_name, tenant_email, units(label, properties(name)), profiles:occupant_profile_id(full_name, email)"
      )
      .not("move_in_date", "is", null)
      .returns<OccRow[]>(),
    db
      .from("anniversary_emails")
      .select("resident_id")
      .eq("year", year)
      .returns<{ resident_id: string }[]>(),
  ]);

  const sentThisYear = new Set((emailed ?? []).map((r) => r.resident_id));

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const all = (occ ?? [])
    .filter((o) => o.move_in_date)
    .map((o) => {
      const info = annivInfo(o.move_in_date!, today);
      const [, mm, dd] = o.move_in_date!.split("-").map(Number);
      // The next time this anniversary comes around.
      let next = new Date(today.getFullYear(), mm - 1, dd);
      if (next < startOfToday) next = new Date(today.getFullYear() + 1, mm - 1, dd);
      const daysAway = Math.round((next.getTime() - startOfToday.getTime()) / 86_400_000);
      // Whole years completed as of that next anniversary.
      const nextYears = next.getFullYear() - Number(o.move_in_date!.slice(0, 4));
      return {
        id: o.occupant_profile_id,
        unitId: o.unit_id,
        name: o.profiles?.full_name ?? o.tenant_name ?? o.profiles?.email ?? "—",
        email: o.profiles?.email ?? o.tenant_email ?? null,
        home: (o.units?.properties?.name ?? "—") + " · " + (o.units?.label ?? "—"),
        moveIn: o.move_in_date!,
        years: info.years,
        nextYears,
        next,
        daysAway,
        day: info.day,
        isThisMonth: info.isThisMonth,
        passed: info.isThisMonth && info.day < today.getDate(),
        emailed: o.occupant_profile_id ? sentThisYear.has(o.occupant_profile_id) : false,
      };
    })
    .filter((r) => r.nextYears >= 1);

  const rows = all.filter((r) => r.isThisMonth && r.years >= 1).sort((a, b) => a.day - b.day);
  const soon = all
    .filter((r) => !r.isThisMonth && r.daysAway <= 90)
    .sort((a, b) => a.daysAway - b.daysAway);
  const longest = [...all].sort((a, b) => b.years - a.years).slice(0, 6);

  const upcoming = rows.filter((r) => !r.passed).length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Anniversaries"
        subtitle={`Residents celebrating a move-in anniversary in ${MONTHS[today.getMonth()]}.`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="This month" value={rows.length} tone="pine" />
        <StatCard label="Still upcoming" value={upcoming} tone="gold" />
        <StatCard
          label="Congrats sent"
          value={rows.filter((r) => r.emailed).length}
          hint={`In ${year}`}
        />
      </div>

      <p className="mb-6 text-sm text-ink-soft">
        A congratulations email goes out automatically on each resident&apos;s
        anniversary. Use{" "}
        <span className="font-medium text-ink">Send now</span> to reach out early
        or add a personal touch — it records the send so the automatic one
        won&apos;t double up.
      </p>

      {rows.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Resident</th>
                  <th className="px-5 py-3 font-medium">Home</th>
                  <th className="px-5 py-3 font-medium">Milestone</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {rows.map((r) => (
                  <tr key={r.unitId} className="align-middle hover:bg-sand/30">
                    <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                      {MONTHS[today.getMonth()].slice(0, 3)} {r.day}
                      {r.passed && (
                        <span className="ml-2 text-xs text-ink-faint">(passed)</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.id ? (
                        <Link
                          href={`/admin/residents/${r.id}`}
                          className="font-medium text-pine hover:text-pine-dark"
                        >
                          {r.name}
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/units/${r.unitId}`}
                          className="font-medium text-pine hover:text-pine-dark"
                        >
                          {r.name}
                        </Link>
                      )}
                      <div className="text-xs text-ink-faint">{r.email ?? "No email on file"}</div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{r.home}</td>
                    <td className="px-5 py-3">
                      <span className="font-semibold text-ink">
                        {r.years} year{r.years === 1 ? "" : "s"}
                      </span>
                      <div className="text-xs text-ink-faint">
                        Since {formatDate(r.moveIn)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.emailed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pine/10 px-3 py-1 text-xs font-medium text-pine">
                          ✓ Emailed
                        </span>
                      ) : r.email && r.id ? (
                        <form action={sendAnniversaryCongrats}>
                          <input type="hidden" name="resident_id" value={r.id} />
                          <button
                            type="submit"
                            className="whitespace-nowrap rounded-lg border border-clay-deep px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-sand"
                          >
                            Send now
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-ink-faint">
                          {r.email ? "No portal account" : "No email"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title={`No anniversaries in ${MONTHS[today.getMonth()]}`}
          body="Nobody hits their move-in date this month — the next ones are listed below."
        />
      )}

      {soon.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">Coming up</h2>
          <p className="mb-3 text-sm text-ink-soft">The next 90 days.</p>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-clay">
              {soon.map((r) => (
                <li key={r.unitId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-ink">{r.name}</div>
                    <div className="text-xs text-ink-faint">{r.home}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="font-semibold text-pine">
                      {r.nextYears} year{r.nextYears === 1 ? "" : "s"}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {r.next.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="w-20 text-right text-xs text-ink-faint">
                      {r.daysAway === 0
                        ? "today"
                        : r.daysAway === 1
                          ? "tomorrow"
                          : `in ${r.daysAway} days`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {longest.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">
            Longest-standing residents 🏆
          </h2>
          <p className="mb-3 text-sm text-ink-soft">
            The people who&apos;ve made these communities home the longest.
          </p>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-clay">
              {longest.map((r, i) => (
                <li key={r.unitId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-5 text-sm font-semibold text-ink-faint">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{r.name}</div>
                      <div className="text-xs text-ink-faint">
                        {r.home} · since {formatDate(r.moveIn)}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-lg font-semibold text-pine">
                    {r.years} yrs
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
