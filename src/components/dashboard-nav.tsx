"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode };

function isActive(pathname: string, href: string) {
  if (href === "/portal" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 p-4">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-pine text-cream" : "text-ink-soft hover:bg-clay/50 hover:text-ink",
            ].join(" ")}
          >
            <span className={active ? "text-cream" : "text-ink-faint"}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({
  nav,
  brandLabel,
  brandHref,
}: {
  nav: NavItem[];
  brandLabel: string;
  brandHref: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-clay-deep text-ink hover:bg-sand"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col bg-cream shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-clay px-5">
              <Link
                href={brandHref}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5"
              >
                <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-pine text-cream">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 11l9-7 9 7M5 10v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="font-display text-base font-semibold text-ink">
                  {brandLabel}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-sand"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {nav.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={[
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-pine text-cream"
                        : "text-ink-soft hover:bg-clay/50 hover:text-ink",
                    ].join(" ")}
                  >
                    <span className={active ? "text-cream" : "text-ink-faint"}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="shrink-0 space-y-2 border-t border-clay p-4">
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="block text-sm font-medium text-ink-soft hover:text-ink"
              >
                Your account
              </Link>
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="block text-xs text-ink-faint hover:text-ink-soft"
              >
                ← Back to website
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
