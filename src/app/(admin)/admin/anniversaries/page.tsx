import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { formatDate } from "@/lib/format";
import { annivInfo } from "@/lib/anniversary";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAnniversaryCongrats } from "./actions";

type OccRow = {
  occupant_profile_id: string | null;
  move_in_date: string | null;
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
        "occupant_profile_id, move_in_date, units(label, properties(name)), profiles:occupant_profile_id(full_name, email)"
      )
      .not("occupant_profile_id", "is", null)
      .not("move_in_date", "is", null)
      .returns<OccRow[]>(),
    db
      .from("anniversary_emails")
      .select("resident_id")
      .eq("year", year)
      .returns<{ resident_id: string }[]>(),
  ]);

  const sentThisYear = new Set((emailed ?? []).map((r) => r.resident_id));

  const rows = (occ ?? [])
    .filter((o) => o.move_in_date && o.occupant_profile_id)
    .map((o) => {
      const info = annivInfo(o.move_in_date!, today);
      return {
        id: o.occupant_profile_id!,
        name: o.profiles?.full_name ?? o.profiles?.email ?? "—",
        email: o.profiles?.email ?? null,
        home:
          (o.units?.properties?.name ?? "—") + " · " + (o.units?.label ?? "—"),
        moveIn: o.move_in_date!,
        years: info.years,
        day: info.day,
        isThisMonth: info.isThisMonth,
        passed: info.day < today.getDate(),
        emailed: sentThisYear.has(o.occupant_profile_id!),
      };
    })
    .filter((r) => r.isThisMonth && r.years >= 1)
    .sort((a, b) => a.day - b.day);

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
                  <tr key={r.id} className="align-middle hover:bg-sand/30">
                    <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                      {MONTHS[today.getMonth()].slice(0, 3)} {r.day}
                      {r.passed && (
                        <span className="ml-2 text-xs text-ink-faint">(passed)</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/residents/${r.id}`}
                        className="font-medium text-pine hover:text-pine-dark"
                      >
                        {r.name}
                      </Link>
                      <div className="text-xs text-ink-faint">{r.email}</div>
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
                      ) : r.email ? (
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
                        <span className="text-xs text-ink-faint">No email</span>
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
          title="No anniversaries this month"
          body="Residents reach their move-in anniversary based on the move-in date on their unit. Check back next month."
        />
      )}
    </div>
  );
}
