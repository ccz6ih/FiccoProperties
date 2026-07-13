import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Map Resend event types to our email_log status, with a rank so out-of-order
// events never downgrade (a late "delivered" won't overwrite "opened").
const STATUS_BY_EVENT: Record<string, string> = {
  "email.sent": "sent",
  "email.delivery_delayed": "delivery_delayed",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "opened",
  "email.bounced": "bounced",
  "email.complained": "complained",
};
const RANK: Record<string, number> = {
  sent: 1,
  delivery_delayed: 1,
  delivered: 2,
  opened: 3,
  bounced: 4,
  complained: 4,
};

/** Verify Resend's Svix-style webhook signature. */
function verify(secret: string, headers: Headers, payload: string): boolean {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${id}.${ts}.${payload}`;
  const expected = createHmac("sha256", secretBytes).update(signed).digest("base64");
  // Header is a space-separated list of "v1,<signature>".
  return sigHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    try {
      return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret && !verify(secret, req.headers, body)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 });
  }

  const status = event.type ? STATUS_BY_EVENT[event.type] : undefined;
  const messageId = event.data?.email_id;
  if (!status || !messageId) return NextResponse.json({ ok: true, ignored: event.type });

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: row } = await db
    .from("email_log")
    .select("status")
    .eq("message_id", messageId)
    .maybeSingle<{ status: string }>();

  // Don't downgrade a stronger status with a late/out-of-order event.
  if (row && (RANK[status] ?? 0) < (RANK[row.status] ?? 0)) {
    return NextResponse.json({ ok: true, kept: row.status });
  }

  await db
    .from("email_log")
    .update({ status, last_event_at: new Date().toISOString() })
    .eq("message_id", messageId);

  return NextResponse.json({ ok: true, status });
}
