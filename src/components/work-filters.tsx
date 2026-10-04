"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export type FilterOption = { value: string; label: string };

const control =
  "rounded-lg border border-clay-deep bg-white px-2.5 py-1.5 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

/**
 * Filters for the work list. Everything is a URL parameter, so a filtered view
 * is a link you can bookmark or send — "everything open at Villa Victoria" is
 * a URL, not a thing you re-click every morning.
 */
export function WorkFilters({
  places,
  units,
  people,
  counts,
}: {
  places: FilterOption[];
  units: FilterOption[];
  people: FilterOption[];
  counts: { live: number; overdue: number; done: number; all: number };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`/admin/work?${next.toString()}`);
  };

  const state = params.get("state") ?? "live";
  const STATES: { key: string; label: string; count: number }[] = [
    { key: "live", label: "Open", count: counts.live },
    { key: "overdue", label: "Overdue", count: counts.overdue },
    { key: "done", label: "Done", count: counts.done },
    { key: "all", label: "Everything", count: counts.all },
  ];

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {STATES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => set("state", s.key === "live" ? "" : s.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              state === s.key ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
            }`}
          >
            {s.label}
            <span
              className={`ml-1.5 text-xs ${state === s.key ? "text-cream/70" : "text-ink-faint"}`}
            >
              {s.count}
            </span>
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          set("q", q);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search — fence, faucet, a unit, a name…"
          className={`${control} w-64`}
        />

        <select value={params.get("source") ?? "all"} onChange={(e) => set("source", e.target.value)} className={control}>
          <option value="all">Maintenance &amp; tasks</option>
          <option value="maintenance">Maintenance only</option>
          <option value="task">Tasks only</option>
        </select>

        <select value={params.get("place") ?? "all"} onChange={(e) => set("place", e.target.value)} className={control}>
          <option value="all">Every community</option>
          {places.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <select value={params.get("unit") ?? "all"} onChange={(e) => set("unit", e.target.value)} className={control}>
          <option value="all">Every home</option>
          {units.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>

        <select value={params.get("who") ?? "all"} onChange={(e) => set("who", e.target.value)} className={control}>
          <option value="all">Anyone</option>
          <option value="none">Unassigned</option>
          {people.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-ink-faint">
          From
          <input
            type="date"
            value={params.get("from") ?? ""}
            onChange={(e) => set("from", e.target.value)}
            className={control}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-faint">
          To
          <input
            type="date"
            value={params.get("to") ?? ""}
            onChange={(e) => set("to", e.target.value)}
            className={control}
          />
        </label>

        {[...params.keys()].length > 0 && (
          <button
            type="button"
            onClick={() => router.push("/admin/work")}
            className="text-xs font-medium text-pine hover:underline"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
