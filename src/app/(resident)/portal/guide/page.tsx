import { Card, Eyebrow, Button } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { TOWN_HOME_RULES, NEVER_FLUSH, TOWNHOME_SLUGS } from "@/lib/house-guides";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { acknowledgeRules } from "./actions";

type HomeRow = {
  units: { properties: { slug: string | null } | null } | null;
};

export default async function PortalGuide() {
  const { user, profile } = await requireProfile("/portal/guide");
  const supabase = await createClient();

  const { data: home } = await supabase
    .from("unit_occupancy")
    .select("units(properties(slug))")
    .eq("occupant_profile_id", user.id)
    .maybeSingle<HomeRow>();

  const slug = home?.units?.properties?.slug ?? null;
  const isTownhome = !!slug && TOWNHOME_SLUGS.includes(slug);
  const ackAt =
    (profile as unknown as { house_rules_ack_at: string | null } | null)
      ?.house_rules_ack_at ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="House rules & care"
        subtitle="A quick reference for keeping our community looking great and your home running smoothly."
      />

      {isTownhome && (
        <Card className="mb-8 p-6">
          <Eyebrow>Town home rules</Eyebrow>
          <p className="mt-2 text-sm text-ink-soft">
            These keep our townhomes tidy, safe, and code-compliant with the City of
            Wheat Ridge. Thanks for doing your part.
          </p>
          <ol className="mt-5 space-y-4">
            {TOWN_HOME_RULES.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine/10 text-sm font-semibold text-pine">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink">{r.title}</div>
                  <p className="mt-0.5 text-sm text-ink-soft">{r.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card className="p-6">
        <Eyebrow>Plumbing do&apos;s &amp; don&apos;ts</Eyebrow>
        <h2 className="mt-2 font-display text-xl font-semibold text-ink">
          Never flush these down the toilet
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Only the “3 P&apos;s” belong in the toilet — pee, poop, and (toilet) paper.
          Flushing anything else is the #1 cause of clogs and backups. When in doubt,
          throw it out.
        </p>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {NEVER_FLUSH.map((f, i) => (
            <li
              key={i}
              className="rounded-xl border border-clay bg-sand/30 p-3"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-terracotta-dark">⊘</span>
                <span className="text-sm font-semibold text-ink">{f.item}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{f.why}</p>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-xl border border-pine/30 bg-pine/5 p-4 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Grease tip:</span> let cooking
          grease cool, then scrape it into the trash — never down the sink or toilet.
          A clog from grease or wipes can back up into your home, so this really helps.
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          Notice a slow drain or running toilet? Submit a maintenance request and
          we&apos;ll take care of it before it becomes a bigger problem.
        </p>
      </Card>

      {/* Acknowledgment */}
      <Card className="mt-8 p-6">
        {ackAt ? (
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine/10 text-pine">
              ✓
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">
                Thanks — you&apos;re all set
              </div>
              <div className="text-xs text-ink-faint">
                You acknowledged the house rules on {formatDate(ackAt)}.
              </div>
            </div>
          </div>
        ) : (
          <form action={acknowledgeRules} className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              Please confirm you&apos;ve read and understand the rules above.
            </p>
            <Button type="submit" variant="primary">
              I&apos;ve read &amp; understand
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
