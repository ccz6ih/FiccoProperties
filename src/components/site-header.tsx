import Link from "next/link";
import { Container, ButtonLink } from "@/components/ui";

const nav = [
  { href: "/#communities", label: "Communities" },
  { href: "/#about", label: "About" },
  { href: "/apply", label: "Apply" },
];

export function SiteHeader({ user }: { user?: { email?: string | null } | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-clay/70 bg-cream/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg font-semibold text-ink">
            38th Ave Properties
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/portal" variant="outline" className="hidden sm:inline-flex">
              My portal
            </ButtonLink>
          ) : (
            <Link
              href="/login"
              className="hidden text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:block"
            >
              Resident login
            </Link>
          )}
          <ButtonLink href="/apply" variant="primary">
            Apply now
          </ButtonLink>
        </div>
      </Container>
    </header>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 place-items-center rounded-xl bg-pine text-cream"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 11l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 19v-5h4v5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
