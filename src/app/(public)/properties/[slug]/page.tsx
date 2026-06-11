import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container, Eyebrow, Badge, ButtonLink, Card } from "@/components/ui";
import { getPropertyBySlug } from "@/lib/queries";
import { getCommunityContent } from "@/lib/content";
import { propertyTypeLabel } from "@/lib/format";

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPropertyBySlug(slug);
  if (!data) return { title: "Community not found" };
  return {
    title: data.property.name,
    description: getCommunityContent(slug).blurb,
  };
}

export default async function PropertyPage({ params }: Params) {
  const { slug } = await params;
  const data = await getPropertyBySlug(slug);
  if (!data) notFound();

  const { property, units } = data;
  const content = getCommunityContent(slug);
  const total = units.length;
  const available = units.filter(
    (u) => u.status === "available" || u.status === "make_ready"
  ).length;

  return (
    <>
      {/* Hero */}
      <section className={`bg-gradient-to-br ${content.gradient} text-cream`}>
        <div className="bg-grain">
          <Container className="py-16 lg:py-24">
            <div className="max-w-2xl space-y-5">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-cream/15 px-3 py-1 text-xs font-medium text-cream backdrop-blur">
                  {propertyTypeLabel(property.type)}
                </span>
                <span className="text-sm text-cream/80">{content.tagline}</span>
              </div>
              <h1 className="text-5xl font-semibold leading-tight">
                {property.name}
              </h1>
              <p className="text-lg leading-relaxed text-cream/85">
                {content.blurb}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <ButtonLink
                  href={`/apply?property=${property.slug}`}
                  size="lg"
                  variant="accent"
                >
                  Apply to {property.name.split(" ")[0]}
                </ButtonLink>
                <span className="text-sm text-cream/80">
                  {property.address_line1}, {property.city}, {property.state}{" "}
                  {property.postal_code}
                </span>
              </div>
            </div>
          </Container>
        </div>
      </section>

      {/* Stats + highlights */}
      <section className="py-16">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <Card className="grid grid-cols-3 gap-px overflow-hidden bg-clay p-0">
              <MiniStat value={String(total)} label="Homes" />
              <MiniStat
                value={available > 0 ? String(available) : "0"}
                label="Available"
              />
              <MiniStat value={property.state ?? "CO"} label="Location" />
            </Card>
            <Card className="space-y-3 p-6">
              <Eyebrow>Availability</Eyebrow>
              {available > 0 ? (
                <p className="text-ink-soft">
                  <span className="font-semibold text-pine">
                    {available} {available === 1 ? "home is" : "homes are"}
                  </span>{" "}
                  ready for new applications right now.
                </p>
              ) : (
                <p className="text-ink-soft">
                  This community is fully leased. Apply to join the waitlist —
                  we&apos;ll reach out the moment something opens up.
                </p>
              )}
              <ButtonLink href={`/apply?property=${property.slug}`} variant="primary">
                {available > 0 ? "Apply now" : "Join the waitlist"}
              </ButtonLink>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Eyebrow>What you&apos;ll love</Eyebrow>
              <h2 className="text-3xl font-semibold text-ink">
                Life at {property.name}
              </h2>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {content.highlights.map((h) => (
                <li
                  key={h}
                  className="flex items-center gap-3 rounded-xl border border-clay bg-white/60 px-4 py-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pine-soft text-pine-dark">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-ink">{h}</span>
                </li>
              ))}
            </ul>

            <Card className="flex flex-col items-start gap-3 bg-sand/60 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-display text-lg font-semibold text-ink">
                  Questions before you apply?
                </div>
                <p className="text-sm text-ink-soft">
                  Our on-site team is happy to help.
                </p>
              </div>
              <ButtonLink href="mailto:hello@ficcoproperties.com" variant="outline">
                Contact us
              </ButtonLink>
            </Card>
          </div>
        </Container>
      </section>

      {/* Back link */}
      <section className="pb-16">
        <Container>
          <ButtonLink href="/#communities" variant="ghost">
            ← All communities
          </ButtonLink>
          <Badge tone="neutral" className="ml-2">
            Updated regularly
          </Badge>
        </Container>
      </section>
    </>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-cream p-5 text-center">
      <div className="font-display text-2xl font-semibold text-pine">{value}</div>
      <div className="mt-0.5 text-xs text-ink-soft">{label}</div>
    </div>
  );
}
