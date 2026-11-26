import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delivery reporting from SMTP2GO.
 *
 * Moving off Resend cost us the answer to "did it actually arrive?". Over plain
 * SMTP the server accepts a message and the conversation ends, so every send
 * was recorded as `handed_off` and nothing more — which looks fine right up
 * until sixteen households are told their hot water is being fixed and nobody
 * can confirm a single one received it.
 *
 * SMTP2GO will post events back if asked, so this puts the real outcome into
 * the same email_log column the Resend webhook used to fill.
 *
 * Set it up: SMTP2GO → Settings → Webhooks → Manage Webhooks
 *   URL     https://38thaveproperties.com/api/webhooks/smtp2go
 *   Events  delivered, bounce, spam, reject
 *   Header  Authorization: Bearer <SMTP2GO_WEBHOOK_SECRET>
 */

// SMTP2GO sends "delivered", "bounce", "spam", "reject", "open", "click".
// Ranked so a late event can never downgrade a stronger one — an "open" that
// arrives after a "bounce" must not make a failure look like a success.
const STATUS_BY_EVENT: Record<string, string> = {
  processed: "sent",
  delivered: "delivered",
  open: "opened",
  click: "opened",
  bounce: "bounced",
  spam: "complained",
  unsubscribe: "complained",
  reject: "failed",
};
const RANK: Record<string, number> = {
  handed_off: 1,
  sent: 1,
  delivered: 2,
  opened: 3,
  bounced: 4,
  complained: 4,
  failed: 4,
};

/**
 * SMTP2GO does not sign its payloads, so there is no HMAC to check. The only
 * protection available is a shared secret on an Authorization header, which is
 * why the comparison is still constant-time: the header is the whole lock.
 */
function authorised(req: Request): boolean {
  const secret = process.env.SMTP2GO_WEBHOOK_SECRET;
  if (!secret) return true; // not configured yet — accept, so setup can be tested
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  } catch {
    return false;
  }
}

type Event = {
  event?: string;
  /** SMTP2GO's own id for the message. */
  message_id?: string;
  email_id?: string;
  rcpt?: string;
  /** Why it bounced, when it did. */
  reason?: string;
  bounce_reason?: string;
};

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  let payload: Event | Event[];
  try {
    payload = (await req.json()) as Event | Event[];
  } catch {
    return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 });
  }

  const events = Array.isArray(payload) ? payload : [payload];
  const db = createAdminClient() as unknown as SupabaseClient;
  let applied = 0;

  for (const e of events) {
    const status = e.event ? STATUS_BY_EVENT[e.event.toLowerCase()] : undefined;
    // SMTP2GO reports the id with angle brackets, the way it travels on the
    // wire; nodemailer handed us the same shape, so they match as-is.
    const messageId = e.message_id ?? e.email_id;
    if (!status || !messageId) continue;

    // Message ids travel with angle brackets and SMTP2GO may report them
    // either way, so match both rather than silently finding nothing.
    const bare = messageId.replace(/^<|>$/g, "");
    const { data: row } = await db
      .from("email_log")
      .select("message_id, status, subject")
      .in("message_id", [messageId, `<${bare}>`, bare])
      .maybeSingle<{ message_id: string; status: string; subject: string }>();
    if (!row) continue;

    if ((RANK[status] ?? 0) < (RANK[row.status] ?? 0)) continue;

    // There is no column for a failure reason — the existing convention puts
    // it on the end of the subject, where the email log already reads it.
    const reason = e.reason ?? e.bounce_reason ?? null;
    const failed = status === "bounced" || status === "failed";
    const subject =
      failed && reason && !row.subject.includes(" — FAILED:")
        ? `${row.subject} — FAILED: ${reason}`
        : row.subject;

    await db
      .from("email_log")
      .update({ status, last_event_at: new Date().toISOString(), subject })
      .eq("message_id", row.message_id);
    applied += 1;
  }

  return NextResponse.json({ ok: true, applied, received: events.length });
}
