import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import {
  AnnouncementComposeForm,
  type PropertyOpt,
} from "@/components/announcement-compose-form";
import { deleteAnnouncement } from "./actions";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type AnnRow = {
  id: string;
  title: string;
  body: string;
  property_ids: string[] | null;
  expires_on: string | null;
  created_at: string;
};

type ReceiptRow = { announcement_id: string; profile_id: string };

export default async function AdminAnnouncements() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: anns }, { data: receipts }, { data: props }, { data: occ }, { data: members }] =
    await Promise.all([
      db
        .from("announcements")
        .select("id, title, body, property_ids, expires_on, created_at")
        .order("created_at", { ascending: false })
        .returns<AnnRow[]>(),
      db
        .from("announcement_receipts")
        .select("announcement_id, profile_id")
        .returns<ReceiptRow[]>(),
      db.from("properties").select("id, name").order("name").returns<PropertyOpt[]>(),
      db
        .from("unit_occupancy")
        .select("unit_id, occupant_profile_id, units(property_id)")
        .returns<{ unit_id: string; occupant_profile_id: string | null; units: { property_id: string | null } | null }[]>(),
      db
        .from("unit_occupants")
        .select("unit_id, profile_id")
        .returns<{ unit_id: string; profile_id: string }[]>(),
    ]);

  const properties = (props ?? []).filter((p): p is PropertyOpt => !!p.name);
  const propName = new Map(properties.map((p) => [p.id, p.name]));

  // Which property each portal account lives in (occupancy link + co-tenants).
  const unitProperty = new Map<string, string>();
  for (const o of occ ?? []) {
    if (o.units?.property_id) unitProperty.set(o.unit_id, o.units.property_id);
  }
  const accountProperty = new Map<string, string>();
  for (const o of occ ?? []) {
    if (o.occupant_profile_id && o.units?.property_id)
      accountProperty.set(o.occupant_profile_id, o.units.property_id);
  }
  for (const m of members ?? []) {
    const pid = unitProperty.get(m.unit_id);
    if (pid && !accountProperty.has(m.profile_id)) accountProperty.set(m.profile_id, pid);
  }

  const ackedBy = new Map<string, Set<string>>();
  for (const r of receipts ?? []) {
    const set = ackedBy.get(r.announcement_id) ?? new Set<string>();
    set.add(r.profile_id);
    ackedBy.set(r.announcement_id, set);
  }

  const eligibleCount = (a: AnnRow) => {
    const targets = a.property_ids && a.property_ids.length > 0 ? new Set(a.property_ids) : null;
    let n = 0;
    for (const [, pid] of accountProperty) if (!targets || targets.has(pid)) n++;
    return n;
  };

  const list = anns ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Announcements"
        subtitle="Post building news — water shut-offs, snow removal, pest treatment — and see exactly who's acknowledged it."
      />

      <Card className="mb-8 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">New announcement</h2>
        <AnnouncementComposeForm properties={properties} />
      </Card>

      {list.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Announcement</th>
                  <th className="px-5 py-3 font-medium">Communities</th>
                  <th className="px-5 py-3 font-medium">Posted</th>
                  <th className="px-5 py-3 font-medium">Acknowledged</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {list.map((a) => {
                  const acked = ackedBy.get(a.id)?.size ?? 0;
                  const eligible = eligibleCount(a);
                  const pct = eligible > 0 ? Math.round((acked / eligible) * 100) : 0;
                  const communities =
                    a.property_ids && a.property_ids.length > 0
                      ? a.property_ids.map((id) => propName.get(id) ?? "—").join(", ")
                      : "All";
                  return (
                    <tr key={a.id} className="hover:bg-sand/30">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/announcements/${a.id}`}
                          className="font-medium text-pine hover:underline"
                        >
                          {a.title}
                        </Link>
                        {a.expires_on && (
                          <div className="text-xs text-ink-faint">
                            Comes down {formatDate(a.expires_on)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{communities}</td>
                      <td className="px-5 py-3 text-ink-soft">{formatDate(a.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-clay">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? "bg-pine" : "bg-gold"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-ink-soft">
                            {acked}/{eligible}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <form action={deleteAnnouncement}>
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            type="submit"
                            className="text-xs text-ink-faint hover:text-terracotta-dark"
                            title="Remove announcement"
                          >
                            ✕
                          </button>
                        </form>
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
          title="No announcements yet"
          body="Post one above — residents see it in their portal and tap 'Got it', and you keep the receipt."
        />
      )}
    </div>
  );
}
