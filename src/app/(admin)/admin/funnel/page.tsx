import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { createClient } from "@/lib/supabase/server";

type EventRow = { session_id: string; step: string; property_id: string | null };
type PrequalRow = { passed: boolean };

const STEPS: { key: string; label: string; note: string }[] = [
  { key: "listing_view", label: "Looked at listings", note: "Visited a property page or the availability board" },
  { key: "prequal_start", label: "Started the qualifier", note: "Began the 60-second pre-qual quiz" },
  { key: "prequal_complete", label: "Finished the qualifier", note: "Got their instant answer" },
  { key: "application_start", label: "Opened the application", note: "Landed on the apply page" },
  { key: "application_complete", label: "Submitted an application", note: "The conversion that matters" },
];

export default async function AdminFunnel() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const since = new Date(new Date().getTime() - 30 * 86_400_000).toISOString();

  const [{ data: events }, { data: prequals }, { data: waitlist }, { data: props }] =
    await Promise.all([
      db
        .from("funnel_events")
        .select("session_id, step, property_id")
        .gte("created_at", since)
        .returns<EventRow[]>(),
      db.from("prequal_submissions").select("passed").gte("created_at", since).returns<PrequalRow[]>(),
      db.from("waitlist_entries").select("id").gte("created_at", since).returns<{ id: string }[]>(),
      db.from("properties").select("id, name").returns<{ id: string; name: string | null }[]>(),
    ]);

  // Distinct sessions per step (raw server events count once each).
  const sessionsByStep = new Map<string, Set<string>>();
  const viewsByProperty = new Map<string, Set<string>>();
  for (const e of events ?? []) {
    const set = sessionsByStep.get(e.step) ?? new Set<string>();
    set.add(e.session_id);
    sessionsByStep.set(e.step, set);
    if (e.step === "listing_view" && e.property_id) {
      const p = viewsByProperty.get(e.property_id) ?? new Set<string>();
      p.add(e.session_id);
      viewsByProperty.set(e.property_id, p);
    }
  }
  const count = (step: string) => sessionsByStep.get(step)?.size ?? 0;

  const rows = STEPS.map((s, i) => {
    const n = count(s.key);
    const prev = i > 0 ? count(STEPS[i - 1].key) : null;
    const rate = prev != null && prev > 0 ? Math.round((n / prev) * 100) : null;
    return { ...s, n, rate };
  });

  const top = rows[0]?.n ?? 0;
  const hasData = (events ?? []).length > 0;

  // Where's the biggest bleed? (largest absolute drop between adjacent steps)
  let worst: { from: string; to: string; lost: number } | null = null;
  for (let i = 1; i < rows.length; i++) {
    const lost = rows[i - 1].n - rows[i].n;
    if (rows[i - 1].n > 0 && (!worst || lost > worst.lost)) {
      worst = { from: rows[i - 1].label, to: rows[i].label, lost };
    }
  }

  const propName = new Map((props ?? []).map((p) => [p.id, p.name ?? "—"]));
  const propViews = [...viewsByProperty.entries()]
    .map(([id, set]) => ({ name: propName.get(id) ?? "—", n: set.size }))
    .sort((a, b) => b.n - a.n);

  const prequalTotal = (prequals ?? []).length;
  const prequalPassed = (prequals ?? []).filter((p) => p.passed).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Marketing funnel"
        subtitle="Last 30 days — where lookers become applicants, and where they leak out."
      />

      {!hasData ? (
        <EmptyState
          title="No traffic recorded yet"
          body="Once people browse the site, you'll see each step here: listings viewed → pre-qualified → application started → submitted."
        />
      ) : (
        <>
          {worst && worst.lost > 0 && (
            <Card className="mb-6 border-gold/50 bg-gold/10 p-5">
              <div className="text-sm text-ink">
                <strong>Biggest leak:</strong> {worst.lost} {worst.lost === 1 ? "person" : "people"} dropped
                between <strong>{worst.from.toLowerCase()}</strong> and{" "}
                <strong>{worst.to.toLowerCase()}</strong>. That&apos;s the step to fix first.
              </div>
            </Card>
          )}

          <Card className="mb-6 overflow-hidden">
            <div className="border-b border-clay bg-sand/50 px-5 py-3">
              <h2 className="font-display text-base font-semibold text-ink">The funnel</h2>
              <p className="text-xs text-ink-faint">Unique visitors reaching each step.</p>
            </div>
            <div className="space-y-1 p-5">
              {rows.map((r) => {
                const pct = top > 0 ? Math.max(4, Math.round((r.n / top) * 100)) : 0;
                return (
                  <div key={r.key} className="flex items-center gap-3 py-1.5">
                    <div className="w-52 shrink-0">
                      <div className="text-sm font-medium text-ink">{r.label}</div>
                      <div className="text-[11px] text-ink-faint">{r.note}</div>
                    </div>
                    <div className="h-7 flex-1 overflow-hidden rounded-lg bg-sand">
                      <div
                        className="flex h-full items-center rounded-lg bg-pine px-2 text-xs font-bold text-cream"
                        style={{ width: `${pct}%` }}
                      >
                        {r.n}
                      </div>
                    </div>
                    <div className="w-16 shrink-0 text-right text-xs text-ink-soft">
                      {r.rate != null ? `${r.rate}%` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-ink">Listing views by community</h2>
              {propViews.length > 0 ? (
                <ul className="space-y-2">
                  {propViews.map((p) => (
                    <li key={p.name} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{p.name}</span>
                      <span className="font-semibold text-pine">{p.n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-faint">No property-page views yet.</p>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-ink">Side doors</h2>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-ink">Pre-qual checks run</span>
                  <span className="font-semibold text-pine">{prequalTotal}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink">…looked like strong fits</span>
                  <span className="font-semibold text-pine">{prequalPassed}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink">Waitlist joins</span>
                  <span className="font-semibold text-pine">{(waitlist ?? []).length}</span>
                </li>
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
