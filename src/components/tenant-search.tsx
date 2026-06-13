"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusPill } from "@/components/dashboard-ui";
import type { SearchItem } from "@/lib/admin-search";

const norm = (s: string) => s.toLowerCase();

export function TenantSearch({
  items,
  autoFocus = false,
  limit = 40,
}: {
  items: SearchItem[];
  autoFocus?: boolean;
  limit?: number;
}) {
  const [q, setQ] = useState("");

  const haystacks = useMemo(
    () =>
      items.map((it) => ({
        it,
        hay: norm(
          [it.tenantName, it.email, it.phone, it.unitLabel, it.property, it.status]
            .filter(Boolean)
            .join(" ")
        ),
      })),
    [items]
  );

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return haystacks
      .filter(({ hay }) => terms.every((t) => hay.includes(t)))
      .map(({ it }) => it);
  }, [q, haystacks]);

  const shown = results.slice(0, limit);

  return (
    <div>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" strokeLinecap="round" />
        </svg>
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tenants, units, email, phone…"
          className="w-full rounded-xl border border-clay-deep bg-white py-3 pl-11 pr-4 text-sm text-ink shadow-sm focus:border-pine focus:outline-none"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {q.trim() === "" ? (
        <p className="mt-3 text-sm text-ink-faint">
          Type a name, unit number, community, email, or phone to find a tenant.
          {" "}
          {items.length} units indexed.
        </p>
      ) : results.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">No matches for “{q}”.</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-ink-faint">
            {results.length} match{results.length === 1 ? "" : "es"}
            {results.length > limit ? ` · showing first ${limit}` : ""}
          </p>
          <ul className="mt-2 divide-y divide-clay overflow-hidden rounded-xl border border-clay">
            {shown.map((it) => (
              <li
                key={it.unitId}
                className="flex flex-wrap items-center justify-between gap-3 bg-cream px-4 py-3 hover:bg-sand/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">
                      {it.tenantName ?? "Vacant"}
                    </span>
                    <StatusPill value={it.status} />
                    {it.linked && (
                      <span className="rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-medium text-pine">
                        Linked
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-faint">
                    {it.property} · {it.unitLabel}
                    {it.email ? ` · ${it.email}` : ""}
                    {it.phone ? ` · ${it.phone}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
                  <Link href={`/admin/units/${it.unitId}`} className="text-pine hover:underline">
                    Unit
                  </Link>
                  {it.residentId && (
                    <Link
                      href={`/admin/residents/${it.residentId}`}
                      className="text-pine hover:underline"
                    >
                      Resident
                    </Link>
                  )}
                  {it.slug && (
                    <Link
                      href={`/admin/properties/${it.slug}`}
                      className="text-ink-soft hover:underline"
                    >
                      Community
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
