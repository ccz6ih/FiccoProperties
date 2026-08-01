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
  const forLine = [d.period ? `for ${esc(d.period)}` : "", "rent"].filter(Boolean).join(" ");
  const subject = `Payment received — ${amount}`;

  const rows: [string, string][] = [
    ["Amount received", amount],
    ["Home", esc(d.home)],
  ];
  if (d.refLabel) rows.push(["Reference", esc(d.refLabel)]);
  if (d.remainingCents > 0) rows.push(["Balance remaining", formatCents(d.remainingCents)]);
  const table = `<table style="border-collapse:collapse;margin:10px 0 4px">${rows
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:4px 16px 4px 0;color:${FAINT};font-size:13px">${k}</td><td style="padding:4px 0;font-size:13px;font-weight:600;color:${i === rows.length - 1 && d.remainingCents > 0 ? TERRA : INK}">${v}</td></tr>`
    )
    .join("")}</table>`;

  const fortune = `<div style="border-left:3px solid ${GOLD};background:${SAND};border:1px solid ${LINE};border-left-width:3px;border-radius:8px;padding:12px 16px;margin:18px 0 4px">
      <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">A little something for your month 🥠</div>
      <div style="font-family:Georgia,serif;font-size:15px;font-style:italic;color:${INK};line-height:1.5">${esc(pickFortune())}</div>
    </div>`;

  const portalLink = d.hasPortal
    ? `<p style="margin:14px 0 0;font-size:13px"><a href="${d.appUrl}/portal/payments" style="color:${PINE};font-weight:600;text-decoration:none">View your payment history →</a></p>`
    : "";

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:${INK}">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:${PINE};margin-bottom:2px">38th Ave Properties</div>
    <div style="font-size:13px;color:${FAINT};margin-bottom:16px">Payment confirmation</div>

    <div style="font-family:Georgia,serif;font-size:18px;color:${PINE};margin-bottom:8px">Thank you, ${esc(d.name)} — we received your payment ✓</div>
    <p style="margin:0 0 6px;font-size:14px;line-height:1.6">We've recorded your ${forLine} payment. Here's your receipt:</p>
    ${table}
    ${d.remainingCents > 0 ? `<p style="margin:6px 0 0;font-size:13px;color:${TERRA}">A balance of ${formatCents(d.remainingCents)} is still outstanding for this charge.</p>` : ""}
    ${fortune}
    ${portalLink}
    <p style="margin:16px 0 0;font-size:12px;color:${FAINT}">Questions about this payment? Reply to this email or call (720) 527-2596. Please keep this receipt for your records.</p>
    <p style="margin:12px 0 0;font-size:12px;color:${FAINT}">38th Ave Properties · W 38th Ave, Wheat Ridge, CO · Equal Housing Opportunity</p>
  </div>`;

  return { subject, html };
}
