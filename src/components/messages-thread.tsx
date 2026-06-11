"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";

export type ThreadMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Realtime thread. `currentUserId` is the viewer; `staffIds` is the set of
 * profile ids that are staff (so we can colour bubbles correctly regardless of
 * who is viewing). `sendAction` is the appropriate server action (resident or
 * staff) bound by the parent page.
 */
export function MessagesThread({
  conversationId,
  currentUserId,
  staffIds,
  initialMessages,
  senderNames,
  senders,
  sendAction,
}: {
  conversationId: string;
  currentUserId: string;
  staffIds: string[];
  initialMessages: ThreadMessage[];
  senderNames: Record<string, string>;
  senders: Record<string, { name: string | null; avatarUrl: string | null }>;
  sendAction: (form: FormData) => Promise<void>;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const staffSet = new Set(staffIds);

  // Subscribe to inserts on this conversation only. RLS still guards the data:
  // a resident only receives rows the policy lets them read.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as ThreadMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Keep the latest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    setPending(true);

    // Optimistic append; realtime reconciles by id.
    const optimistic: ThreadMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");

    const form = new FormData();
    form.set("conversation_id", conversationId);
    form.set("body", text);
    await sendAction(form);
    setPending(false);
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 px-1 py-2">
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          const fromStaff = staffSet.has(m.sender_id);
          const sender = senders[m.sender_id];
          return (
            <div
              key={m.id}
              className={cn("flex flex-col", mine ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "flex max-w-[80%] items-end gap-2",
                  mine ? "flex-row-reverse" : "flex-row"
                )}
              >
                <Avatar
                  size="sm"
                  name={sender?.name ?? null}
                  url={sender?.avatarUrl ?? null}
                />
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm",
                    fromStaff
                      ? "bg-pine-soft text-pine-dark"
                      : "bg-sand text-ink"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
              <div className="mt-1 px-1 text-[11px] text-ink-faint">
                {senderNames[m.sender_id] ?? (fromStaff ? "Ficco team" : "Resident")}
                {" · "}
                {formatTime(m.created_at)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex items-end gap-3">
        <textarea
          name="body"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className={cn(inputClass, "resize-none")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
        <Button type="submit" variant="primary" disabled={pending || !body.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
