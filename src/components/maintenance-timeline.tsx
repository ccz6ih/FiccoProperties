import { formatDate } from "@/lib/format";

/**
 * Package-tracker style progress for a maintenance request:
 * Submitted → Assigned → Scheduled → Completed. Server-rendered.
 */
export function MaintenanceTimeline({
  createdAt,
  assigned,
  scheduledFor,
  scheduledWindow,
  status,
  completedAt,
}: {
  createdAt: string;
  assigned: boolean;
  scheduledFor: string | null;
  scheduledWindow: string | null;
  status: string;
  completedAt: string | null;
}) {
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const steps = [
    { label: "Submitted", done: true, detail: formatDate(createdAt) },
    {
      label: "Assigned",
      done: assigned || isCompleted,
      detail: assigned || isCompleted ? "We're on it" : "Waiting for review",
    },
    {
      label: "Scheduled",
      done: !!scheduledFor || isCompleted,
      detail: scheduledFor
        ? `${formatDate(scheduledFor)}${scheduledWindow ? ` · ${scheduledWindow}` : ""}`
        : isCompleted
          ? "—"
          : "We'll confirm a time",
    },
    {
      label: "Completed",
      done: isCompleted,
      detail: isCompleted ? formatDate(completedAt ?? scheduledFor ?? createdAt) : "",
    },
  ];

  if (isCancelled) {
    return (
      <p className="rounded-lg bg-sand px-3 py-2 text-xs text-ink-soft">
        This request was cancelled. If that&apos;s a surprise, message us below.
      </p>
    );
  }

  return (
    <div>
      <ol className="flex items-start">
        {steps.map((s, i) => (
          <li key={s.label} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div
                className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : steps[i - 1].done ? "bg-pine" : "bg-clay"}`}
              />
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  s.done ? "bg-pine text-cream" : "border-2 border-clay bg-cream text-ink-faint"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div
                className={`h-0.5 flex-1 ${i === steps.length - 1 ? "bg-transparent" : s.done && steps[i + 1].done ? "bg-pine" : s.done ? "bg-clay" : "bg-clay"}`}
              />
            </div>
            <div className={`mt-1 text-[11px] font-medium ${s.done ? "text-ink" : "text-ink-faint"}`}>
              {s.label}
            </div>
            {s.detail && <div className="text-[10px] text-ink-faint">{s.detail}</div>}
          </li>
        ))}
      </ol>
      {status === "on_hold" && (
        <p className="mt-2 rounded-lg bg-gold/15 px-3 py-1.5 text-xs text-ink">
          ⏸ On hold — usually waiting on a part or scheduling. Message us below for details.
        </p>
      )}
      {scheduledFor && !isCompleted && (
        <p className="mt-2 rounded-lg bg-pine/10 px-3 py-1.5 text-xs font-medium text-pine">
          🔧 We&apos;re scheduled to come {formatDate(scheduledFor)}
          {scheduledWindow ? `, ${scheduledWindow}` : ""}. You don&apos;t need to be home.
        </p>
      )}
    </div>
  );
}
