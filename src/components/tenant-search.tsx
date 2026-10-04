"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusPill } from "@/components/dashboard-ui";
import type { SearchItem, WorkSearchItem } from "@/lib/admin-search";
import { matchesTerms, splitTerms } from "@/lib/search-match";

const norm = (s: string) => s.toLowerCase();

export function TenantSearch({
  items,
  work = [],
  autoFocus = false,
  limit = 40,
}: {
  items: SearchItem[];
  /** Maintenance + tasks, so one box finds the job as well as the home. */
  work?: WorkSearchItem[];
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
    const terms = splitTerms(q);
    if (terms.length === 0) return [];
    return haystacks.filter(({ hay }) => matchesTerms(hay, terms)).map(({ it }) => it);
  }, [q, haystacks]);

  const workHaystacks = useMemo(
    () =>
      work.map((w) => ({
        w,
        hay: norm([w.title, w.details, w.where, w.assignee, w.source].filter(Boolean).join(" ")),
      })),
    [work]
  );

  const workResults = useMemo(() => {
    const terms = splitTerms(q);
    if (terms.length === 0) return [];
    return workHaystacks.filter(({ hay }) => matchesTerms(hay, terms)).map(({ w }) => w);
  }, [q, workHaystacks]);

  const shown = results.slice(0, limit);
  const workShown = workResults.slice(0, limit);

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
          placeholder="Search homes, people, repairs, tasks…"
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
          Find a home or a person by name, unit, community, email or phone — or a repair or task
          by what it was about. {items.length} homes and {work.length} jobs indexed.
        </p>
      ) : results.length === 0 && workResults.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">No matches for “{q}”.</p>
      ) : (
        <>
          {results.length > 0 && (
            <>
          <p className="mt-3 text-xs text-ink-faint">
            {results.length} home{results.length === 1 ? "" : "s"}
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

          {/* Repairs and tasks, so the box answers "what happened with the
              faucet" as well as "who lives in Unit 5". */}
          {workResults.length > 0 && (
            <>
              <p className="mt-4 text-xs text-ink-faint">
                {workResults.length} repair{workResults.length === 1 ? "" : "s"} &amp; task
                {workResults.length === 1 ? "" : "s"}
                {workResults.length > limit ? ` · showing first ${limit}` : ""}
              </p>
              <ul className="mt-2 divide-y divide-clay overflow-hidden rounded-xl border border-clay">
                {workShown.map((w) => (
                  <li key={`${w.source}-${w.id}`} className="bg-cream hover:bg-sand/40">
                    <Link href={w.href} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              w.source === "maintenance"
                                ? "bg-pine/10 text-pine"
                                : "bg-clay-deep/25 text-ink-soft"
                            }`}
                          >
                            {w.source === "maintenance" ? "Maintenance" : "Task"}
                          </span>
                          <span className="font-medium text-ink">{w.title}</span>
                          {w.state === "done" && (
                            <span className="text-[11px] text-ink-faint">done</span>
                          )}
                        </div>
                        <div className="text-xs text-ink-faint">
                          {w.where ?? "No home"}
                          {w.assignee ? ` · ${w.assignee}` : ""} · {w.dateLabel}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-pine">Open →</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-faint">
                <Link href={`/admin/work?state=all&q=${encodeURIComponent(q)}`} className="font-medium text-pine hover:underline">
                  See these in All work →
                </Link>
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
