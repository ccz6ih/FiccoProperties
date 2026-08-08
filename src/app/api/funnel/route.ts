import { NextResponse } from "next/server";
import { logFunnelEvent, FUNNEL_STEPS, type FunnelStep } from "@/lib/funnel";

/** Lightweight beacon endpoint for client-side funnel pings. */
export async function POST(req: Request) {
  let body: { step?: string; sessionId?: string; propertyId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const step = FUNNEL_STEPS.find((s) => s === body.step) as FunnelStep | undefined;
  if (!step || !body.sessionId) return NextResponse.json({ ok: false }, { status: 400 });

  // Basic sanity on the ids so junk can't be written.
  const sessionId = String(body.sessionId).slice(0, 64);
  const propertyId =
    body.propertyId && /^[0-9a-f-]{36}$/i.test(body.propertyId) ? body.propertyId : null;

  await logFunnelEvent({ step, sessionId, propertyId });
  return NextResponse.json({ ok: true });
}
