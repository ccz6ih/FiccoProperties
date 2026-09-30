/**
 * The move-out walk-through, in the order you'd do it standing in the home.
 *
 * Lives here rather than beside the server action because a "use server" file
 * may only export async functions — exporting this from there breaks the build.
 * Shared by recording a move-out and by editing one afterwards, so the two can
 * never drift apart.
 */
export type MoveOutCheck = { name: string; label: string; hint: string };

export const MOVE_OUT_CHECKS: MoveOutCheck[] = [
  {
    name: "chk_notice",
    label: "Proper written notice given",
    hint: "Month-to-month needs 21 days in Colorado.",
  },
  {
    name: "chk_keys",
    label: "All keys, fobs and openers returned",
    hint: "Including mailbox and garage.",
  },
  {
    name: "chk_empty",
    label: "Home emptied — nothing left behind",
    hint: "Including the storage unit and patio.",
  },
  {
    name: "chk_clean",
    label: "Cleaned to move-in standard",
    hint: "Normal wear is fine; filth is deductible.",
  },
  {
    name: "chk_damage",
    label: "No damage beyond normal wear",
    hint: "Photograph anything that isn't.",
  },
  {
    name: "chk_photos",
    label: "Move-out photos taken",
    hint: "The evidence behind any deduction.",
  },
  {
    name: "chk_utilities",
    label: "Utilities transferred out of their name",
    hint: "So the empty home doesn't bill them.",
  },
];
