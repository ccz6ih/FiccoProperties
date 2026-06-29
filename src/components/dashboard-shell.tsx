import Link from "next/link";
import { SidebarNav, MobileNav, type NavItem } from "@/components/dashboard-nav";
import { Avatar } from "@/components/avatar";

export type { NavItem };

export function DashboardShell({
  brandHref,
  brandLabel,
  nav,
  user,
  children,
}: {
  brandHref: string;
  brandLabel: string;
  nav: NavItem[];
  user: {
    email?: string | null;
    name?: string | null;
    role?: string | null;
    avatarUrl?: string | null;
  };
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-cream">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-clay bg-sand/40 lg:flex print:hidden">
        <Link href={brandHref} className="flex h-16 items-center gap-2.5 border-b border-clay px-6">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-pine text-cream">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 11l9-7 9 7M5 10v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-base font-semibold text-ink">{brandLabel}</span>
        </Link>
        <SidebarNav nav={nav} />
        <div className="border-t border-clay p-4">
          <Link href="/" className="text-xs text-ink-faint hover:text-ink-soft">
            ← Back to website
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-clay bg-cream px-4 sm:px-8 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav nav={nav} brandLabel={brandLabel} brandHref={brandHref} />
            <Link
              href={brandHref}
              className="truncate font-display text-base font-semibold text-ink lg:hidden"
            >
              {brandLabel}
            </Link>
          </div>
          <div className="hidden flex-1 lg:block" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/account"
              className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-sand sm:pr-3"
              title="Your account"
            >
              <Avatar name={user.name} url={user.avatarUrl} size="md" />
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-medium text-ink">{user.name || user.email}</div>
                {user.role && (
                  <div className="text-xs capitalize text-ink-faint">{user.role}</div>
                )}
              </div>
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-clay-deep px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-sand"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-5 py-8 sm:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
