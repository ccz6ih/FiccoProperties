"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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

export function MobileNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:hidden">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium",
              active ? "bg-pine text-cream" : "text-ink-soft hover:bg-clay/50",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
