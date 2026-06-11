import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Eyebrow } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { requireProfile } from "@/lib/auth";

export default async function CommunityPage() {
  await requireProfile("/portal/community");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Community"
        subtitle="Hours, contact, and the everyday details."
      />

      <div className="space-y-6">
        {/* Contact & office hours — prominent */}
        <Card className="border-pine/30 bg-pine-soft/60 p-6">
          <Eyebrow>Contact &amp; office hours</Eyebrow>
          <div className="mt-3 space-y-4 text-sm text-ink-soft">
            <p className="text-ink">
              Call us at{" "}
              <a
                href="tel:+17205272596"
                className="font-semibold text-pine hover:text-pine-dark"
              >
                720-527-2596
              </a>
              .
            </p>
            <p>
              <span className="font-medium text-ink">Office hours:</span>{" "}
              Monday–Friday, 9:00&nbsp;AM – 4:00&nbsp;PM.
            </p>
            <p className="rounded-xl border border-pine/20 bg-white/70 px-4 py-3 leading-relaxed">
              We&apos;re a small, part-time team, so{" "}
              <strong className="font-semibold text-ink">
                please call rather than stop by
              </strong>
              . Calling is the fastest way to reach us, and we&apos;ll get right
              back to you.
            </p>
            <p className="leading-relaxed">
              For maintenance,{" "}
              <Link
                href="/portal/maintenance"
                className="font-medium text-pine hover:text-pine-dark"
              >
                submit a request
              </Link>
              . For anything urgent, call the number above.
            </p>
          </div>
        </Card>

        {/* Trash & recycling */}
        <Section title="Trash & recycling">
          <ul className="space-y-2">
            <Item>
              Trash is collected{" "}
              <strong className="font-semibold text-ink">
                Monday, Wednesday, and Friday
              </strong>
              .
            </Item>
            <Item>
              Please use the dumpsters for normal household trash only.{" "}
              <strong className="font-semibold text-ink">
                No furniture or large/bulk items in the dumpsters
              </strong>{" "}
              — improper dumping (furniture, mattresses, and the like) will be
              charged to the responsible resident.
            </Item>
            <Item>
              Our staff walk the grounds regularly and tidy up around the units.
            </Item>
          </ul>
        </Section>

        {/* Laundry */}
        <Section title="Laundry">
          <ul className="space-y-2">
            <Item>
              The on-site laundry rooms are{" "}
              <strong className="font-semibold text-ink">cleaned weekly</strong>.
            </Item>
          </ul>
        </Section>

        {/* Parking & vehicles */}
        <Section title="Parking & vehicles">
          <ul className="space-y-2">
            <Item>
              Keep a{" "}
              <strong className="font-semibold text-ink">
                current, valid license plate
              </strong>{" "}
              on your vehicle at all times.
            </Item>
            <Item>
              <strong className="font-semibold text-ink">
                No vehicle repairs or work on cars
              </strong>{" "}
              in the parking lots.
            </Item>
            <Item>
              <strong className="font-semibold text-ink">Townhomes:</strong> you
              may park one vehicle in front of your unit and one in the back.
            </Item>
          </ul>
        </Section>

        {/* Community rules */}
        <Section title="Community rules">
          <ul className="space-y-2">
            <Item>
              <strong className="font-semibold text-ink">No pets</strong> (no
              dogs or cats).{" "}
              <span className="text-ink-faint">
                Assistance animals are not pets and may be requested as a
                reasonable accommodation.
              </span>
            </Item>
            <Item>
              <strong className="font-semibold text-ink">
                No satellite dishes.
              </strong>
            </Item>
            <Item>
              <strong className="font-semibold text-ink">
                Renters insurance
              </strong>{" "}
              is required — proof is due on move-in.
            </Item>
            <Item>
              To move out, give{" "}
              <strong className="font-semibold text-ink">
                30 days&apos; written notice, on the 1st of the month
              </strong>
              .
            </Item>
            <Item>
              Please be considerate of your neighbors with noise and shared
              spaces.
            </Item>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-ink-soft">
        {children}
      </div>
    </Card>
  );
}

function Item({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
      <span>{children}</span>
    </li>
  );
}
