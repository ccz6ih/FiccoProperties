/**
 * Keeping the public contact form from being used as a mail relay.
 *
 * The form had no protection of any kind and sent a confirmation email to
 * whatever address was typed into it. Between 28 Sep and 8 Nov 2026 that was
 * used to send 40 unsolicited emails to 37 strangers' addresses — which is
 * what the email provider saw, and why the account was banned.
 *
 * The defences are deliberately layered, because any one of them is beatable:
 *
 *   honeypot   a field no human can see; bots fill every field they find
 *   content    a name holding a URL or Cyrillic is not a person's name
 *   rate       a handful per address per hour, regardless of anything else
 *
 * A rejected submission is told it succeeded. Telling a bot which rule it
 * tripped is just free tuning advice.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Verdict =
  | { ok: true }
  | { ok: false; verdict: string; reason: string };

export { HONEYPOT_FIELD } from "@/lib/contact-honeypot";

const URL_RE = /(https?:\/\/|www\.|\.(com|net|org|ru|xyz|top|click|shop)\b)/i;
// Cyrillic, CJK and Arabic in a *name* field. Not a judgement about who may
// write in — the message body is untouched and may be in any language. It is
// that every abusive submission so far put its payload in the name.
const FOREIGN_SCRIPT_RE = /[Ѐ-ӿ一-鿿؀-ۿ]/;

/** One-way, salted with the deploy's own secret: enough to count, not to track. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 16) ?? "38thave";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** The real client address behind Vercel's proxy. */
export function clientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

/** Cheap checks that need no database round trip. */
export function screenContent(fields: {
  name: string;
  email: string;
  phone: string;
  message: string;
  honeypot: string;
}): Verdict {
  if (fields.honeypot.trim().length > 0) {
    return { ok: false, verdict: "rejected_honeypot", reason: "hidden field filled" };
  }

  // A name is a name. Every abusive submission so far put a sales pitch here.
  if (URL_RE.test(fields.name)) {
    return { ok: false, verdict: "rejected_content", reason: "link in the name" };
  }
  if (FOREIGN_SCRIPT_RE.test(fields.name)) {
    return { ok: false, verdict: "rejected_content", reason: "non-Latin script in the name" };
  }
  if (fields.name.length > 80) {
    return { ok: false, verdict: "rejected_content", reason: "name far too long" };
  }

  // A genuine enquiry about renting a home does not need three links.
  const links = fields.message.match(/https?:\/\//gi)?.length ?? 0;
  if (links > 1) {
    return { ok: false, verdict: "rejected_content", reason: `${links} links in the message` };
  }
  if (fields.message.length > 4000) {
    return { ok: false, verdict: "rejected_content", reason: "message far too long" };
  }

  return { ok: true };
}

/**
 * How many we've accepted recently from this address or this sender.
 *
 * Counts accepted submissions only, so a flood of rejects can't lock out a
 * real person who writes in afterwards from the same coffee shop.
 */
export async function withinRateLimit(
  db: SupabaseClient,
  ipHash: string | null,
  email: string
): Promise<Verdict> {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  if (ipHash) {
    const { count } = await db
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("verdict", "accepted")
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= 3) {
      return { ok: false, verdict: "rejected_rate", reason: "3 from this address in an hour" };
    }
  }

  // Also cap per email address, so rotating IPs doesn't buy unlimited sends
  // to one victim.
  const { count: byEmail } = await db
    .from("contact_submissions")
    .select("id", { count: "exact", head: true })
    .ilike("email", email)
    .eq("verdict", "accepted")
    .gte("created_at", dayAgo);
  if ((byEmail ?? 0) >= 3) {
    return { ok: false, verdict: "rejected_rate", reason: "3 to this email in a day" };
  }

  return { ok: true };
}

/** Write down what happened, accepted or not. Best-effort; never blocks. */
export async function recordSubmission(
  db: SupabaseClient,
  row: {
    ipHash: string | null;
    name: string;
    email: string;
    phone: string;
    message: string;
    verdict: string;
    reason?: string;
  }
): Promise<void> {
  try {
    await db.from("contact_submissions").insert({
      ip_hash: row.ipHash,
      name: row.name.slice(0, 200),
      email: row.email.slice(0, 200),
      phone: row.phone.slice(0, 50),
      message: row.message.slice(0, 4000),
      verdict: row.verdict,
      reason: row.reason ?? null,
    });
  } catch {
    /* the log is a nicety; never let it cost a genuine enquiry */
  }
}
