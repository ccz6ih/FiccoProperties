/** Shared result shape for "send an email" server actions (with UI feedback). */
export type EmailActionState = { ok: boolean; error?: string; sentTo?: string };
