import { Card } from "@/components/ui";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";
import { TOWNHOME_SLUGS, TOWN_HOME_RULES } from "@/lib/house-guides";

export type WelcomeFact = { label: string; value: string };

/** Pull one rule out of the posted notices by title, so the wording matches. */
const rule = (title: string) => TOWN_HOME_RULES.find((r) => r.title === title)?.body ?? null;

function FactRow({ label, value }: WelcomeFact) {
  return (
    <div className="border-b border-clay/60 px-5 py-3.5 last:border-0 sm:flex sm:gap-5">
      <div className="text-sm font-semibold text-ink sm:w-40 sm:shrink-0">{label}</div>
      <div className="mt-0.5 text-[15px] leading-relaxed text-ink-soft sm:mt-0">{value}</div>
    </div>
  );
}

/**
 * "Getting to know the place" — the orientation a new resident actually needs.
 *
 * The questions that get asked in the first week are never about the lease;
 * they're where the trash goes and where to park. Those answers were written
 * down already, on the posted notices, so this reads them from the same place
 * the house-rules page does rather than restating them slightly differently.
 *
 * Anything specific to one community — laundry, utilities, who plows — is
 * staff-entered on the property, because it isn't ours to guess.
 */
export function WelcomeOverview({
  propertyName,
  propertySlug,
  bedrooms,
  bathrooms,
  propertyType,
  welcomeNote,
  facts,
}: {
  propertyName: string | null;
  propertySlug: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  welcomeNote: string | null;
  facts: WelcomeFact[];
}) {
  const isTownhome = propertySlug ? TOWNHOME_SLUGS.includes(propertySlug) : false;

  const homeShape = [
    bedrooms != null ? `${bedrooms} bedroom` : null,
    bathrooms != null ? `${bathrooms} bath` : null,
    propertyType ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Facts we can state because they're recorded, not assumed.
  const known: WelcomeFact[] = [];
  if (homeShape) known.push({ label: "Your home", value: homeShape });
  known.push({
    label: "Rent",
    value: `Due the 1st of each month. There's a 7-day grace period before a late fee applies.`,
  });
  known.push({
    label: "Dropping off rent",
    value: `${RENT_DROPBOX.full} — payable to ${RENT_DROPBOX.payee}. Write your unit number on it.`,
  });
  if (isTownhome) {
    const parking = rule("Parking");
    const trash = rule("Use the dumpster (lids closed)");
    const patio = rule("Patios: outside items only");
    if (parking) known.push({ label: "Parking", value: parking });
    if (trash) known.push({ label: "Trash", value: trash });
    if (patio) known.push({ label: "Your patio", value: patio });
  }
  known.push({
    label: "Something broken?",
    value: "Submit it in the portal under Maintenance, any hour. You'll see it move to done.",
  });
  known.push({
    label: "Reaching us",
    value: `Call ${RENT_DROPBOX.phone}, message us from the portal, or stop by the office at ${RENT_DROPBOX.line1}.`,
  });

  const all = [...facts, ...known];

  return (
    <div className="space-y-4">
      {welcomeNote && (
        <Card className="overflow-hidden p-0">
          <div className="border-l-4 border-pine px-6 py-5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">
              About {propertyName ?? "the community"}
            </div>
            <p className="mt-1.5 whitespace-pre-line text-[17px] leading-relaxed text-ink">
              {welcomeNote}
            </p>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-clay bg-sand/50 px-5 py-4">
          <h2 className="font-display text-xl font-semibold text-ink">
            Getting to know the place
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            The small things that are good to know before the first week.
          </p>
        </div>
        <div>
          {all.map((f) => (
            <FactRow key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      </Card>

      {/* What the day itself looks like. The photo step matters most — it's
          what protects their deposit — so it's named as theirs, not ours. */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-clay bg-sand/50 px-5 py-4">
          <h2 className="font-display text-xl font-semibold text-ink">On move-in day</h2>
        </div>
        <ol className="divide-y divide-clay/60">
          {[
            [
              "Pick up your keys",
              `Meet us at the office — ${RENT_DROPBOX.line1} — and we'll walk the home together.`,
            ],
            [
              "Photograph everything",
              "Take photos of every room before you unpack and upload them in the portal. This is the record that protects your deposit when you eventually move out — it's worth twenty minutes.",
            ],
            [
              "Tell us what needs attention",
              "Anything you spot on that first walk, send it straight through as a maintenance request. Nothing is too small.",
            ],
            [
              "Read the house rules",
              "A short read, and we ask you to acknowledge it in the portal so we know you've seen it.",
            ],
          ].map(([title, body], i) => (
            <li key={title} className="flex items-start gap-4 px-5 py-4">
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-bold text-ink-soft"
                aria-hidden
              >
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-ink">{title}</div>
                <div className="mt-0.5 text-[15px] leading-relaxed text-ink-soft">{body}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
