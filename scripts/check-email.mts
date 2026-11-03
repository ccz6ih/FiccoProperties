/**
 * Prove the email setup works before trusting it with a real notice.
 *
 * Reads .env.local exactly the way the app reads its environment, connects to
 * whatever provider is configured, and optionally sends one real message.
 *
 *   npx tsx scripts/check-email.mts                 — connect and verify only
 *   npx tsx scripts/check-email.mts you@email.com   — and send a test to that address
 *
 * Run it again against Vercel's values after deploying, because environment
 * variables are read into the functions at deploy time: changing one in the
 * Vercel dashboard does nothing until the next deploy.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
let raw = "";
try {
  raw = readFileSync(envPath, "utf8");
} catch {
  console.error(`Could not read ${envPath}. Run this from the project folder.`);
  process.exit(1);
}
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const provider =
  (process.env.EMAIL_PROVIDER ?? "").toLowerCase() ||
  (process.env.SMTP_HOST && process.env.SMTP_USER ? "smtp" : "") ||
  (process.env.RESEND_API_KEY ? "resend" : "none");

const from =
  process.env.EMAIL_FROM ||
  '"Craig Carda · 38th Ave Properties" <notifications@38thaveproperties.com>';

console.log(`provider : ${provider}`);
console.log(`from     : ${from}`);
console.log(`notify   : ${process.env.NOTIFY_EMAIL ?? "(not set)"}`);

const to = process.argv[2];

if (provider === "smtp") {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;
  console.log(`host     : ${process.env.SMTP_HOST}:${port} ${secure ? "(TLS)" : "(STARTTLS)"}`);
  console.log(`user     : ${process.env.SMTP_USER}`);

  const nodemailer = (await import("nodemailer")).default;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    connectionTimeout: 10_000,
  });

  try {
    await t.verify();
    console.log("\n✓ connected and the credentials were accepted");
  } catch (err) {
    console.error("\n✗ could not connect:", err instanceof Error ? err.message : err);
    console.error(
      "\n  Usual causes: wrong port (587 vs 465), the password is an API key you have to\n" +
        "  generate rather than your account password, or the account isn't approved to send yet."
    );
    process.exit(1);
  }

  if (to) {
    const info = await t.sendMail({
      from,
      to,
      subject: "38th Ave Properties — email is working",
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6;color:#2c2622">
        <p style="font-family:Georgia,serif;font-size:20px;color:#2f5d50;margin:0 0 10px">Email is working again</p>
        <p>Sent over SMTP via <strong>${process.env.SMTP_HOST}</strong>.</p>
        <p style="font-size:14px;color:#6f655a">If this landed in spam rather than the inbox, the domain's DKIM records for this provider still need adding at GoDaddy — your DMARC policy is set to quarantine, so unauthenticated mail gets filtered.</p>
      </div>`,
    });
    console.log(`✓ sent to ${to} — ${info.messageId}`);
    console.log("  Check the inbox AND the spam folder. Which one it lands in is the real test.");
  } else {
    console.log("\n  Pass an address to send a real test: npx tsx scripts/check-email.mts you@email.com");
  }
} else if (provider === "resend") {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  console.log(res.ok ? "\n✓ Resend key is live" : `\n✗ Resend refused: HTTP ${res.status}`);
  if (!res.ok) console.log(await res.text());
} else {
  console.error("\n✗ No provider configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.");
  process.exit(1);
}
