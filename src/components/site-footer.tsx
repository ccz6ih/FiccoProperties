import Link from "next/link";
import { Container } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-clay bg-sand/60">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="font-display text-lg font-semibold text-ink">
            38th Ave Properties
          </div>
          <p className="max-w-xs text-sm text-ink-soft">
            Family-owned communities on W 38th Avenue in Wheat Ridge, Colorado.
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Communities
          </div>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li><Link href="/properties/mountain-village-square" className="hover:text-ink">Mountain Village Square</Link></li>
            <li><Link href="/properties/senior-villa" className="hover:text-ink">Senior Villa</Link></li>
            <li><Link href="/properties/villa-victoria" className="hover:text-ink">Villa Victoria</Link></li>
            <li><Link href="/properties/the-villa" className="hover:text-ink">The Villa</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Residents
          </div>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li><Link href="/availability" className="hover:text-ink">Availability &amp; waitlist</Link></li>
            <li><Link href="/apply" className="hover:text-ink">Apply online</Link></li>
            <li><Link href="/login" className="hover:text-ink">Resident login</Link></li>
            <li><Link href="/portal/maintenance" className="hover:text-ink">Request maintenance</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Contact
          </div>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>W 38th Ave</li>
            <li>Wheat Ridge, CO 80033</li>
            <li><a href="tel:+17205272596" className="hover:text-ink">(720) 527-2596</a></li>
            <li><Link href="/contact" className="hover:text-ink">hello@38thaveproperties.com</Link></li>
          </ul>
        </div>
      </Container>

      <div className="border-t border-clay/70">
        <Container className="flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-faint sm:flex-row">
          <span>© {new Date().getFullYear()} 38th Ave Properties. All rights reserved.</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-pine" />
              Equal Housing Opportunity
            </span>
            <span className="text-clay-deep">·</span>
            <Link href="/admin" className="text-ink-faint transition-colors hover:text-pine">
              Staff sign in
            </Link>
          </span>
        </Container>
      </div>
    </footer>
  );
}
