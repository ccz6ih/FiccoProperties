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

/** Subject + branded HTML for a resident's move-in anniversary. */
export function anniversaryEmail(opts: {
  firstName: string;
  years: number;
  propertyName: string | null;
}): { subject: string; html: string } {
  const { firstName, years, propertyName } = opts;
  const yr = `${years} year${years === 1 ? "" : "s"}`;
  const where = propertyName ? ` at ${esc(propertyName)}` : "";
  const subject = `Happy ${yr} with us! 🎉`;
  const html = customerHtml(`Happy ${yr} anniversary! 🎉`, [
    `Hi ${esc(firstName)}, today marks <strong>${yr}</strong> since you moved in${where}. Thank you for making 38th Ave Properties your home.`,
    `We're so glad to have you as part of our community. If there's ever anything we can do for you, just reply to this email or send us a message in your resident portal.`,
    `Here's to many more — with appreciation from all of us on the 38th Ave team.`,
  ]);
  return { subject, html };
}
