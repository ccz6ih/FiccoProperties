import { customerHtml, esc } from "@/lib/email";

/**
 * Anniversary math on a "YYYY-MM-DD" move-in date, compared to `today`.
 * String-based on purpose: avoids `new Date("YYYY-MM-DD")` parsing the value as
 * UTC midnight and shifting the month/day in a negative timezone.
 */
export function annivInfo(moveInIso: string, today: Date) {
  const [my, mm, md] = moveInIso.split("-");
  const tmm = String(today.getMonth() + 1).padStart(2, "0");
  const tdd = String(today.getDate()).padStart(2, "0");
  const years = today.getFullYear() - Number(my);
  return {
    years,
    isToday: mm === tmm && md === tdd,
    isThisMonth: mm === tmm,
    day: Number(md),
  };
}

/**
 * A line about time and home, chosen to suit the milestone. Long-timers get
 * the weightier ones; a first year gets something warm and forward-looking.
 */
function quoteFor(years: number): string {
  const early = [
    "\u201cHome is the nicest word there is.\u201d \u2014 Laura Ingalls Wilder",
    "\u201cPeace \u2014 that was the other name for home.\u201d \u2014 Kathleen Norris",
    "\u201cThere is nothing like staying at home for real comfort.\u201d \u2014 Jane Austen",
  ];
  const middle = [
    "\u201cWhere we love is home \u2014 home that our feet may leave, but not our hearts.\u201d \u2014 Oliver Wendell Holmes",
    "\u201cThe magic thing about home is that it feels good to leave, and it feels even better to come back.\u201d \u2014 Wendy Wunder",
    "\u201cA house is made of walls and beams; a home is built with love and dreams.\u201d",
  ];
  const long = [
    "\u201cTime flies over us, but leaves its shadow behind.\u201d \u2014 Nathaniel Hawthorne",
    "\u201cThe ornament of a house is the friends who frequent it.\u201d \u2014 Ralph Waldo Emerson",
    "\u201cCount your life by smiles, not tears. Count your age by friends, not years.\u201d \u2014 John Lennon",
  ];
  const pool = years >= 10 ? long : years >= 4 ? middle : early;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Headline + opening line, tuned to how long they have stayed. */
function milestoneCopy(
  years: number,
  where: string
): { badge: string; headline: string; lead: string } {
  if (years === 1) {
    return {
      badge: "YEAR",
      headline: "Happy first year! \ud83c\udf89",
      lead: `It's been a whole year since you moved in${where}. That first year is when a place stops being an address and starts being home \u2014 thank you for choosing ours.`,
    };
  }
  if (years >= 15) {
    return {
      badge: "YEARS",
      headline: `${years} years. Truly remarkable. \ud83c\udfc6`,
      lead: `Today marks <strong>${years} years</strong> since you moved in${where}. That is longer than most people stay anywhere \u2014 you've watched this neighborhood change, and you've been part of what makes it good. We don't take that lightly.`,
    };
  }
  if (years >= 10) {
    return {
      badge: "YEARS",
      headline: "A full decade \u2014 and then some. \ud83c\udf89",
      lead: `Today marks <strong>${years} years</strong> since you moved in${where}. A decade in one home is rare these days. Thank you for making this one yours for so long.`,
    };
  }
  if (years >= 5) {
    return {
      badge: "YEARS",
      headline: `${years} years with us! \ud83c\udf89`,
      lead: `Today marks <strong>${years} years</strong> since you moved in${where}. You're part of the fabric of this community now, and we're grateful you've stayed.`,
    };
  }
  return {
    badge: "YEARS",
    headline: `Happy ${years}-year anniversary! \ud83c\udf89`,
    lead: `Today marks <strong>${years} years</strong> since you moved in${where}. Thank you for making 38th Ave Properties your home.`,
  };
}

/** Subject + branded HTML for a resident's move-in anniversary. */
export function anniversaryEmail(opts: {
  firstName: string;
  years: number;
  propertyName: string | null;
  /** "YYYY-MM-DD" \u2014 renders a "Home since November 4, 2014" plate. */
  moveInDate?: string | null;
}): { subject: string; html: string } {
  const { firstName, years, propertyName } = opts;
  const PINE = "#2f5d50";
  const INK = "#2c2622";
  const FAINT = "#9b9286";
  const LINE = "#e6dcc8";

  const where = propertyName ? ` at ${esc(propertyName)}` : "";
  const { badge, headline, lead } = milestoneCopy(years, where);
  const quote = quoteFor(years);

  let sinceLine = "";
  if (opts.moveInDate) {
    const [y, m, d] = opts.moveInDate.split("-").map(Number);
    if (y && m && d) {
      sinceLine = new Date(y, m - 1, d).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  const subject =
    years >= 10
      ? `${years} years at 38th Ave \u2014 thank you \ud83c\udfc6`
      : `Happy ${years} year${years === 1 ? "" : "s"} with us! \ud83c\udf89`;

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center">
  <table role="presentation" width="560" style="width:560px;max-width:560px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${PINE};padding:22px 28px">
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div>
      <div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">A note of thanks</div>
    </td></tr>

    <tr><td style="padding:30px 28px 0;text-align:center">
      <table role="presentation" align="center" style="border-collapse:collapse"><tr>
        <td style="background:#e7f0eb;border:2px solid ${PINE};border-radius:60px;padding:16px 28px;text-align:center">
          <div style="font-family:Georgia,serif;font-size:34px;font-weight:700;color:${PINE};line-height:1">${years}</div>
          <div style="font-size:10px;letter-spacing:.14em;color:${PINE};margin-top:2px">${badge}</div>
        </td>
      </tr></table>
      <div style="font-family:Georgia,serif;font-size:24px;color:${INK};margin:18px 0 0">${headline}</div>
    </td></tr>

    <tr><td style="padding:14px 28px 0">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:${INK}">Hi ${esc(firstName)},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${INK}">${lead}</p>
      ${sinceLine ? `<div style="border:1px solid ${LINE};border-radius:10px;padding:10px 16px;margin:0 0 16px;text-align:center"><span style="font-size:11px;color:${FAINT};letter-spacing:.06em">HOME SINCE</span><div style="font-family:Georgia,serif;font-size:16px;color:${INK};margin-top:2px">${esc(sinceLine)}</div></div>` : ""}
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${INK}">We're a small, family-run outfit \u2014 so a resident staying with us year after year is the best sign we're doing something right. If there's ever anything we can do to make your home better, just reply to this email or give us a call. We mean that.</p>
    </td></tr>

    <tr><td style="padding:0 28px">
      <table role="presentation" width="100%" style="background:#faf7f1;border:1px solid ${LINE};border-radius:10px">
        <tr>
          <td style="width:4px;background:#c9932f;font-size:0;line-height:0">&nbsp;</td>
          <td style="padding:14px 18px">
            <div style="font-family:Georgia,serif;font-size:15px;font-style:italic;color:${INK};line-height:1.6">${quote}</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="padding:20px 28px 26px">
      <p style="margin:0;font-size:15px;line-height:1.7;color:${INK}">Here's to many more.</p>
      <p style="margin:6px 0 0;font-family:Georgia,serif;font-size:16px;color:${PINE}">\u2014 Craig, Lou &amp; Tony<br/><span style="font-size:13px;color:${FAINT}">38th Ave Properties</span></p>
      <div style="border-top:1px solid #f0e9db;margin-top:18px;padding-top:12px">
        <p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">38th Ave Properties \u00b7 Wheat Ridge, CO \u00b7 Equal Housing Opportunity</p>
      </div>
    </td></tr>
  </table>
  </td></tr></table></div>`;

  return { subject, html };
}
