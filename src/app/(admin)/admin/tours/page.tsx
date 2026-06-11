import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { TourStatusControl } from "@/components/tour-status-control";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type TourRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  message: string | null;
  status: string;
  created_at: string;
  properties: { name: string | null } | null;
};

export default async function AdminTours() {
  const supabase = await createClient();
  const { data: tours } = await supabase
    .from("tour_requests")
    .select("*, properties(name)")
    .order("created_at", { ascending: false })
    .returns<TourRow[]>();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tour requests"
        subtitle="Prospects who asked to see a community in person."
      />

      {tours && tours.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Community</th>
                  <th className="px-5 py-3 font-medium">Preferred</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {tours.map((t) => (
                  <tr key={t.id} className="hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{t.name}</div>
                      <div className="text-xs text-ink-faint">{t.email}</div>
                      {t.phone && (
                        <div className="text-xs text-ink-faint">{t.phone}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {t.properties?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {t.preferred_date || t.preferred_time
                        ? [formatDate(t.preferred_date), t.preferred_time]
                            .filter((v) => v && v !== "—")
                            .join(" · ")
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <TourStatusControl id={t.id} status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No tour requests yet"
          body="When prospects request a tour from a property page, they'll show up here."
        />
      )}
    </div>
  );
}
