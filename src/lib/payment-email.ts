/** Payment confirmation / receipt email to a tenant when rent is recorded. */
import { formatCents } from "@/lib/format";
import { esc } from "@/lib/email";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const LINE = "#e6dcc8";
const TERRA = "#b4562f";
const GOLD = "#c9932f";
const SAND = "#faf7f1";

/**
 * A little "fortune cookie" for the month — a warm, upbeat line included on each
 * receipt to make paying rent feel a touch more human. Kept friendly and
 * neutral (no politics/religion), home- and community-flavored.
 */
const FORTUNES = [
  "Rent paid, worries parked. Breathe easy this month.",
  "A paid-up month is a calm mind — enjoy the peace.",
  "Home is the one place worth coming back to every single day.",
  "Small steps, taken every month, carry you a long way.",
  "May your coffee be strong and your month be smooth.",
  "The neighborhood's a little better with you in it.",
  "Bloom where you're planted — this is good soil.",
  "The rent is paid; the month is yours. Go make it great.",
  "Good things are coming down the road — keep your porch light on.",
  "A good neighbor is worth more than a fence. Wave at someone today.",
  "Consistency is quiet magic, and you've got it.",
  "This month, do one small thing that makes your home feel more like you.",
  "Warm neighbors make a cold day brighter.",
  "You keep your word, and that means a lot. Thank you.",
  "Cozy season is any season when you love where you live.",
  "A calm home is a superpower — use yours well.",
  "Here's to a month with more sunshine than rain.",
  "Steady as you go: the best kind of progress.",
  "Make this the month you finally light the good candle.",
  "Wishing you a month of green lights and short lines.",
  "The little things — like this — add up to a settled, happy life.",
  "Onward and upward. You're right on track.",
  "Every sunrise on 38th is a fresh start. Make this one count.",
  "Plant a little kindness this month; it grows fast around here.",
  "A tidy ledger and a full heart. You're all set.",
  "May good news find your mailbox this month.",
  "Take the long way home sometimes — the neighborhood's worth it.",
  "Comfort is a home where the people care. Glad you're here.",
  "Good habits look a lot like this. Keep going.",
  "You just bought yourself a month of peace of mind. Nicely done.",
];

/** Pick a fortune, varied per send. */
function pickFortune(): string {
  return FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
}

/** "2026-08" → "August 2026" for a friendlier read. */
function prettyPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function paymentReceiptEmail(d: {
  name: string;
  home: string;
  amountCents: number;
  remainingCents: number;
  period: string | null;
  refLabel: string | null;
  hasPortal: boolean;
  appUrl: string;
}): { subject: string; html: string } {
  const amount = formatCents(d.amountCents);
  const isPartial = d.remainingCents > 0;
  const period = d.period ? prettyPeriod(d.period) : null;
  const subject = `Payment received — ${amount}`;

  const headline = `${isPartial ? "Thanks" : "Thank you"}, ${esc(d.name)}!`;
  const subline = isPartial
    ? `We've applied your payment${period ? ` toward ${period}` : ""} — here's your receipt.`
    : `Your${period ? ` ${period}` : ""} rent is all set. Here's your receipt.`;

  // Detail rows (amount is shown large above, so it's not repeated here).
  const detail: [string, string, boolean][] = [["Home", esc(d.home), false]];
  if (period) detail.push(["For", period, false]);
  if (d.refLabel) detail.push(["Reference", esc(d.refLabel), false]);
  if (isPartial) detail.push(["Balance remaining", formatCents(d.remainingCents), true]);
  const detailRows = detail
    .map(
      ([k, v, warn]) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid #f0e9db;color:${FAINT};font-size:13px">${k}</td><td align="right" style="padding:9px 0;border-bottom:1px solid #f0e9db;color:${warn ? TERRA : INK};font-size:13px;font-weight:600">${v}</td></tr>`
    )
    .join("");

  const balanceNote = isPartial
    ? `<tr><td style="padding:12px 32px 0"><p style="margin:0;font-size:13px;color:${TERRA};line-height:1.55">A balance of <strong>${formatCents(
        d.remainingCents
      )}</strong> is still open on this charge — thank you for taking care of the rest when you can.</p></td></tr>`
    : "";

  const button = d.hasPortal
    ? `<tr><td style="padding:22px 32px 0"><a href="${d.appUrl}/portal/payments" style="display:inline-block;background:${PINE};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 24px;border-radius:8px">View your payment history →</a></td></tr>`
    : "";

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">

      <tr><td style="background:${PINE};padding:22px 32px">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div>
        <div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Payment received</div>
      </td></tr>

      <tr><td style="padding:26px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:46px;height:46px;background:#e7f0eb;border-radius:23px;text-align:center;font-size:24px;color:${PINE};font-weight:700">&#10003;</td></tr></table>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:23px;color:${INK};margin:16px 0 6px">${headline}</div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6f655a">${subline}</p>
      </td></tr>

      <tr><td style="padding:22px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f1;border:1px solid ${LINE};border-radius:12px"><tr><td style="padding:16px 20px;text-align:center">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:${FAINT}">Amount received</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:700;color:${PINE};margin-top:3px">${amount}</div>
        </td></tr></table>
      </td></tr>

      <tr><td style="padding:18px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${detailRows}</table>
      </td></tr>
      ${balanceNote}

      <tr><td style="padding:18px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SAND};border:1px solid ${LINE};border-radius:10px"><tr>
          <td style="width:4px;background:${GOLD};font-size:0;line-height:0">&nbsp;</td>
          <td style="padding:13px 18px">
            <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">A little something for your month &#127850;</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;font-style:italic;color:${INK};line-height:1.55">${esc(pickFortune())}</div>
          </td>
        </tr></table>
      </td></tr>
      ${button}

      <tr><td style="padding:22px 32px 26px">
        <div style="border-top:1px solid #f0e9db;padding-top:16px">
          <p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">Questions about this payment? Just reply to this email or call <strong style="color:#6f655a">(720) 527-2596</strong> — we're always happy to help. Please keep this receipt for your records.</p>
        </div>
      </td></tr>

    </table>
    <div style="font-size:11px;color:${FAINT};margin-top:16px;line-height:1.6">38th Ave Properties &middot; W 38th Ave, Wheat Ridge, CO &middot; Equal Housing Opportunity</div>
  </td></tr></table>
</div>`;

  return { subject, html };
}
