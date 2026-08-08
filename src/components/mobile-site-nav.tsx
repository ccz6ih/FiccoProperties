"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const links = [
  { href: "/#communities", label: "Communities" },
  { href: "/availability", label: "Availability" },
  { href: "/properties/mountain-village-square", label: "Mountain Village Square" },
  { href: "/properties/senior-villa", label: "Senior Villa" },
  { href: "/properties/villa-victoria", label: "Villa Victoria" },
  { href: "/properties/the-villa", label: "The Villa" },
  { href: "/#about", label: "About" },
];

export function MobileSiteNav({ user }: { user?: { email?: string | null } | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
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
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[82%] flex-col bg-cream shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-clay px-5">
              <span className="font-display text-base font-semibold text-ink">Menu</span>
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
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-sm font-medium text-ink-soft hover:bg-clay/50 hover:text-ink"
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="shrink-0 space-y-2 border-t border-clay p-4">
              <Link
                href="/apply"
                onClick={() => setOpen(false)}
                className="block rounded-full bg-pine px-5 py-2.5 text-center text-sm font-medium text-cream hover:bg-pine-dark"
              >
                Apply now
              </Link>
              <Link
                href={user ? "/portal" : "/login"}
                onClick={() => setOpen(false)}
                className="block rounded-full border border-clay-deep px-5 py-2.5 text-center text-sm font-medium text-ink hover:bg-sand"
              >
                {user ? "My portal" : "Resident login"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
