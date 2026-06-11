import { formatDate } from "@/lib/format";

export type LeaseEvent = {
  id: string;
  type: string;
  note: string | null;
  created_at: string;
  actor_id: string | null;
  profiles?: { full_name: string | null } | null;
};

const typeLabel: Record<string, string> = {
  created: "Lease drafted",
  sent: "Sent for signature",
  signed: "Resident signed",
  activated: "Lease activated",
  ended: "Lease ended",
  terminated: "Lease terminated",
  note: "Note",
};

const typeDot: Record<string, string> = {
  created: "bg-sand",
  sent: "bg-gold",
  signed: "bg-pine",
  activated: "bg-pine",
  ended: "bg-ink-faint",
  terminated: "bg-terracotta",
  note: "bg-clay-deep",
};

export function LeaseTimeline({ events }: { events: LeaseEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-faint">No activity yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span
            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${typeDot[e.type] ?? "bg-sand"}`}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink">
              {typeLabel[e.type] ?? e.type}
            </div>
            {e.note && <div className="text-sm text-ink-soft">{e.note}</div>}
            <div className="text-xs text-ink-faint">
              {formatDate(e.created_at)}
              {e.profiles?.full_name ? ` · ${e.profiles.full_name}` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
