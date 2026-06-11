import { Container, Eyebrow, ButtonLink, Card } from "@/components/ui";
import { PropertyCard } from "@/components/property-card";
import { getPropertiesWithCounts } from "@/lib/queries";

export const revalidate = 60;

export default async function HomePage() {
  const properties = await getPropertiesWithCounts();
  const totalUnits = properties.reduce((n, p) => n + p.unitCount, 0);
  const totalAvailable = properties.reduce((n, p) => n + p.availableCount, 0);

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="bg-grain relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-clay-deep to-transparent" />
        <Container className="grid items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="space-y-7">
            <Eyebrow>Wheat Ridge, Colorado · Since 1972</Eyebrow>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] text-ink sm:text-6xl">
              A place to call home on{" "}
              <span className="text-pine">W&nbsp;38th&nbsp;Avenue</span>.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-soft">
              Four family-owned communities — apartments, townhomes, and senior
              living — cared for by the people who own them. Apply online, sign
              your lease, and request maintenance all in one place.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href="/apply" size="lg" variant="accent">
                Start your application
              </ButtonLink>
              <ButtonLink href="/#communities" size="lg" variant="outline">
                Explore communities
              </ButtonLink>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-pine-soft to-terracotta-soft opacity-70 blur-2xl" />
            <Card className="relative grid grid-cols-2 gap-px overflow-hidden bg-clay p-0">
              <Stat value="4" label="Communities" />
              <Stat value={String(totalUnits)} label="Homes" />
              <Stat value="50+" label="Years family-owned" />
              <Stat
                value={totalAvailable > 0 ? String(totalAvailable) : "Waitlist"}
                label={totalAvailable > 0 ? "Homes available" : "Join the waitlist"}
              />
            </Card>
          </div>
        </Container>
      </section>

      {/* ---------------- Communities ---------------- */}
      <section id="communities" className="scroll-mt-20 py-20">
        <Container>
          <div className="mb-10 max-w-2xl space-y-3">
            <Eyebrow>Our communities</Eyebrow>
            <h2 className="text-4xl font-semibold text-ink">
              Four neighborhoods, one block of W&nbsp;38th
            </h2>
            <p className="text-lg text-ink-soft">
              Each community has its own character. Find the one that fits the
              way you want to live.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </Container>
      </section>

      {/* ---------------- About / values ---------------- */}
      <section id="about" className="scroll-mt-20 border-y border-clay bg-sand/50 py-20">
        <Container className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <Eyebrow>Why residents stay</Eyebrow>
            <h2 className="text-4xl font-semibold text-ink">
              Owned by a family, not a fund
            </h2>
            <p className="text-lg leading-relaxed text-ink-soft">
              The family has looked after these buildings for two
              generations. That means decisions get made by people who know your
              name, maintenance gets handled by a team that actually answers,
              and rent stays fair because we&apos;re here for the long run.
            </p>
            <p className="text-lg leading-relaxed text-ink-soft">
              Now we&apos;ve brought that same care online — so applying, signing,
              paying, and getting help is as easy as the neighborhood is
              friendly.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Value title="Responsive maintenance" body="Submit a request from your phone and track it to done." />
            <Value title="Transparent leasing" body="Apply and sign online — no paperwork runarounds." />
            <Value title="On-site management" body="Real people on W 38th who know the buildings inside out." />
            <Value title="Fair, stable rents" body="Long-term ownership means we plan in decades, not quarters." />
          </div>
        </Container>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="py-20">
        <Container>
          <div className="bg-grain relative overflow-hidden rounded-[2rem] bg-pine px-8 py-16 text-center text-cream sm:px-16">
            <h2 className="mx-auto max-w-2xl text-balance text-4xl font-semibold">
              Ready to find your place on 38th?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-cream/80">
              Tell us a little about you and what you&apos;re looking for. It
              takes about three minutes.
            </p>
            <div className="mt-8">
              <ButtonLink href="/apply" size="lg" variant="accent">
                Apply now
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-cream p-6 text-center">
      <div className="font-display text-4xl font-semibold text-pine">{value}</div>
      <div className="mt-1 text-sm text-ink-soft">{label}</div>
    </div>
  );
}

function Value({ title, body }: { title: string; body: string }) {
  return (
    <Card className="space-y-2 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-terracotta-soft text-terracotta-dark">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
    </Card>
  );
}
