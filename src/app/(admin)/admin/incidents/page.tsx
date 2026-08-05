import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { IncidentRequestForm, type ResidentOpt } from "@/components/incident-request-form";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  created_at: string;
  occurred_on: string | null;
  occurred_time: string | null;
  reporter_name: string | null;
  location: string | null;
  narrative: string | null;
  anyone_hurt: string | null;
  police_called: string | null;
  status: string;
  units: { label: string; properties: { name: string | null } | null } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-gold/20 text-ink" },
  reviewed: { label: "Reviewed", cls: "bg-pine/15 text-pine" },
  action_taken: { label: "Action taken", cls: "bg-pine/15 text-pine" },
  closed: { label: "Closed", cls: "bg-sand text-ink-soft" },
};

export default async function AdminIncidents({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: reports }, { data: photoRows }, { data: residentRows }, { data: occRows }] =
    await Promise.all([
      db
        .from("incident_reports")
        .select(
          "id, created_at, occurred_on, occurred_time, reporter_name, location, narrative, anyone_hurt, police_called, status, units:unit_id(label, properties(name))"
        )
        .order("created_at", { ascending: false })
        .returns<Row[]>(),
      db.from("incident_report_photos").select("report_id").returns<{ report_id: string }[]>(),
      db
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "resident")
        .not("email", "is", null)
        .order("full_name")
        .returns<{ id: string; full_name: string | null; email: string | null }[]>(),
      db
        .from("unit_occupancy")
        .select("occupant_profile_id, units:unit_id(label, properties(name))")
        .not("occupant_profile_id", "is", null)
        .returns<{ occupant_profile_id: string; units: { label: string; properties: { name: string | null } | null } | null }[]>(),
    ]);

  const photoCount = new Map<string, number>();
  for (const p of photoRows ?? []) photoCount.set(p.report_id, (photoCount.get(p.report_id) ?? 0) + 1);

  const homeByProfile = new Map<string, string>();
  for (const o of occRows ?? []) {
    if (o.occupant_profile_id && o.units) {
      homeByProfile.set(o.occupant_profile_id, `${o.units.properties?.name ?? "—"} · ${o.units.label}`);
    }
  }
  const residents: ResidentOpt[] = (residentRows ?? []).map((r) => ({
    id: r.id,
    name: r.full_name ?? r.email ?? "Resident",
    home: homeByProfile.get(r.id) ?? null,
  }));
  // Unit-first ordering: by property + unit number, homes before "no home".
  residents.sort((a, b) => {
    if (!a.home !== !b.home) return a.home ? -1 : 1;
    return (
      (a.home ?? "").localeCompare(b.home ?? "", undefined, { numeric: true }) ||
      a.name.localeCompare(b.name)
    );
  });

  const all = reports ?? [];
  const newCount = all.filter((r) => r.status === "new").length;
  const openView = show === "new";
  const rows = openView ? all.filter((r) => r.status === "new") : all;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Incident reports"
        subtitle="Resident-filed reports of safety events, disputes, or damage — kept on file."
      />

      {residents.length > 0 && (
        <Card className="mb-6 p-5">
          <h2 className="font-display text-base font-semibold text-ink">Send the incident form</h2>
          <p className="mb-3 text-xs text-ink-faint">
            Pick a unit and we&apos;ll email that resident a one-click link straight to the incident
            form — no password needed. (Units whose tenant has a portal account appear here.)
          </p>
          <IncidentRequestForm residents={residents} />
        </Card>
      )}

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Filter active={!openView} href="/admin/incidents" label={`All (${all.length})`} />
        {newCount > 0 && (
          <Filter active={openView} href="/admin/incidents?show=new" label={`⚠ Needs review (${newCount})`} />
        )}
      </div>

      {rows.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Reported by / home</th>
                  <th className="px-5 py-3 font-medium">Occurred</th>
                  <th className="px-5 py-3 font-medium">Filed</th>
                  <th className="px-5 py-3 font-medium">Flags</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {rows.map((r) => {
                  const home = r.units
                    ? `${r.units.properties?.name ?? "—"} · ${r.units.label}`
                    : "—";
                  const pc = photoCount.get(r.id) ?? 0;
                  const st = STATUS[r.status] ?? STATUS.new;
                  return (
                    <tr key={r.id} className="hover:bg-sand/30">
                      <td className="px-5 py-3">
                        <Link href={`/admin/incidents/${r.id}`} className="font-medium text-pine hover:underline">
                          {r.reporter_name ?? "Resident"}
                        </Link>
                        <div className="text-xs text-ink-faint">{home}</div>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {r.occurred_on ? formatDate(r.occurred_on) : "—"}
                        {r.occurred_time ? <span className="text-ink-faint"> · {r.occurred_time}</span> : null}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{formatDate(r.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {r.anyone_hurt === "yes" && (
                            <span className="rounded-full bg-terracotta-soft px-2 py-0.5 text-[11px] font-medium text-terracotta-dark">
                              Injury
                            </span>
                          )}
                          {r.police_called === "yes" && (
                            <span className="rounded-full bg-terracotta-soft px-2 py-0.5 text-[11px] font-medium text-terracotta-dark">
                              Police
                            </span>
                          )}
                          {pc > 0 && (
                            <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                              📷 {pc}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title={openView ? "Nothing needs review 🎉" : "No incident reports yet"}
          body="Reports residents file from their portal will appear here, and you'll get an email the moment one comes in."
        />
      )}
    </div>
  );
}

function Filter({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 font-medium ${
        active ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
      }`}
    >
      {label}
    </Link>
  );
}
