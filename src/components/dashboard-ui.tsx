import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { humanize } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "pine",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "pine" | "terracotta" | "gold";
}) {
  const toneClass = {
    pine: "text-pine",
    terracotta: "text-terracotta",
    gold: "text-gold",
  }[tone];
  return (
    <Card className="p-5">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-faint">{hint}</div>}
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sand text-ink-faint">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 7h16v13H4zM4 7l2-3h12l2 3M9 12h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-ink-soft">{body}</p>
      {action}
    </Card>
  );
}

const statusTones: Record<string, string> = {
  new: "bg-pine-soft text-pine-dark",
  reviewing: "bg-[#f6edd6] text-[#8a6a1f]",
  approved: "bg-pine-soft text-pine-dark",
  denied: "bg-terracotta-soft text-terracotta-dark",
  withdrawn: "bg-sand text-ink-soft",
  open: "bg-terracotta-soft text-terracotta-dark",
  in_progress: "bg-[#f6edd6] text-[#8a6a1f]",
  on_hold: "bg-sand text-ink-soft",
  completed: "bg-pine-soft text-pine-dark",
  cancelled: "bg-sand text-ink-soft",
  active: "bg-pine-soft text-pine-dark",
  draft: "bg-sand text-ink-soft",
  pending_signature: "bg-[#f6edd6] text-[#8a6a1f]",
  emergency: "bg-terracotta text-cream",
  high: "bg-terracotta-soft text-terracotta-dark",
  normal: "bg-sand text-ink-soft",
  low: "bg-sand text-ink-faint",
  // make-ready (Phase 3)
  blocked: "bg-terracotta-soft text-terracotta-dark",
  complete: "bg-pine-soft text-pine-dark",
  internal: "bg-[#f6edd6] text-[#8a6a1f]",
  // payments (Phase 5)
  paid: "bg-pine-soft text-pine-dark",
  past_due: "bg-terracotta-soft text-terracotta-dark",
  void: "bg-sand text-ink-faint",
  succeeded: "bg-pine-soft text-pine-dark",
  pending: "bg-[#f6edd6] text-[#8a6a1f]",
  failed: "bg-terracotta-soft text-terracotta-dark",
  refunded: "bg-sand text-ink-soft",
  // application screening
  not_started: "bg-sand text-ink-soft",
  invited: "bg-[#f6edd6] text-[#8a6a1f]",
  passed: "bg-pine-soft text-pine-dark",
  waived: "bg-sand text-ink-faint",
  // profile roles
  owner: "bg-pine-soft text-pine-dark",
  admin: "bg-pine-soft text-pine-dark",
  resident: "bg-sand text-ink-soft",
  applicant: "bg-[#f6edd6] text-[#8a6a1f]",
};

export function StatusPill({ value }: { value: string }) {
  const cls = statusTones[value] ?? "bg-sand text-ink-soft";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {humanize(value)}
    </span>
  );
}
