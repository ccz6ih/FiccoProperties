"use server";

import { sendPasswordReset } from "@/lib/password-reset";

/**
 * Handle a "forgot password" request from the sign-in page.
 *
 * Deliberately returns nothing: the page shows the same message whether or not
 * the address has an account, so this can't be used to enumerate residents.
 * Everything that could fail is swallowed inside sendPasswordReset for the same
 * reason — and because a reset that quietly didn't send is still better than an
 * error message a resident can do nothing about.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordReset(email);
}
