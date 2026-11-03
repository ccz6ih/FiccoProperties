/**
 * Who actually puts the mail on the wire.
 *
 * This used to be a single hard-coded call to Resend, which was fine until
 * Resend banned the account — at which point every notice, receipt, invite and
 * owner report in the system stopped at once, with no way to restore service
 * except a code change and a deploy.
 *
 * So the provider is now a setting, not a decision baked into the source. SMTP
 * is the important one: effectively every transactional provider speaks it, so
 * moving house is a matter of changing four environment variables and
 * redeploying. No vendor can take the system down again for longer than that.
 *
 * Environment:
 *   EMAIL_PROVIDER   smtp | resend — optional; inferred from what's configured
 *   SMTP_HOST        e.g. smtp.mailgun.org, email-smtp.us-east-2.amazonaws.com
 *   SMTP_PORT        587 for STARTTLS (usual), 465 for implicit TLS
 *   SMTP_USER        username the provider gives you
 *   SMTP_PASS        password / API key the provider gives you
 *   RESEND_API_KEY   kept so a reinstated Resend account works by itself again
 */

export type TransportResult = {
  ok: boolean;
  /** Provider's id for the message, where it gives one. */
  id?: string;
  error?: string;
};

export type Outgoing = {
  from: string;
  /** Already split and trimmed. */
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export type ProviderName = "smtp" | "resend" | "none";

/**
 * Which provider is in play. Explicit setting wins; otherwise whatever is
 * configured, preferring SMTP — so pasting SMTP credentials into the
 * environment is on its own enough to switch over.
 */
export function activeProvider(): ProviderName {
  const explicit = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "smtp") return "smtp";
  if (explicit === "resend") return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return "none";
}

/**
 * Does this provider report back what happened to a message after we hand it
 * over? SMTP does not — the server accepts it and the conversation ends — so
 * a plain SMTP send can only ever be recorded as "sent", never "delivered".
 * Worth stating out loud so the email log doesn't look broken.
 */
export function providerHasDeliveryEvents(p: ProviderName = activeProvider()): boolean {
  return p === "resend";
}

async function sendViaResend(msg: Outgoing): Promise<TransportResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "no RESEND_API_KEY set" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      reply_to: msg.replyTo,
    }),
  });

  if (!res.ok) {
    // Read why — "API key is invalid" after a rotation is the common one, and
    // it's worth having in the log rather than a bare failure.
    let reason = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) reason = body.message;
    } catch {
      /* not JSON */
    }
    return { ok: false, error: reason };
  }

  let id: string | undefined;
  try {
    const json = (await res.json()) as { id?: string };
    id = json?.id;
  } catch {
    /* body not JSON — still sent */
  }
  return { ok: true, id };
}

async function sendViaSmtp(msg: Outgoing): Promise<TransportResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok: false, error: "SMTP_HOST, SMTP_USER and SMTP_PASS must all be set" };
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  // 465 is implicit TLS from the first byte; 587 starts plain and upgrades
  // with STARTTLS. Getting this pair wrong is the usual cause of a connection
  // that hangs rather than fails.
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  // Imported here rather than at module scope so that merely loading this file
  // — which half the app does — never pulls nodemailer in.
  const nodemailer = (await import("nodemailer")).default;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // A notice that hangs for a minute blocks the server action behind it, and
    // the person is left looking at a spinner. Fail early and log it instead.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  const info = await transporter.sendMail({
    from: msg.from,
    to: msg.to.join(", "),
    subject: msg.subject,
    html: msg.html,
    replyTo: msg.replyTo,
  });

  // Not every server returns a usable id; a send with none still happened.
  return { ok: true, id: info.messageId || undefined };
}

/** Hand one message to whichever provider is configured. */
export async function deliver(msg: Outgoing): Promise<TransportResult> {
  const provider = activeProvider();
  try {
    if (provider === "smtp") return await sendViaSmtp(msg);
    if (provider === "resend") return await sendViaResend(msg);
    return { ok: false, error: "no email provider configured" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}
