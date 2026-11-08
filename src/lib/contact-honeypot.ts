/**
 * The hidden field's name, on its own so the form and the server can share it
 * without the form reaching for anything server-only.
 *
 * It lives apart from contact-guard.ts deliberately: that file imports
 * node:crypto, and the contact form is a client component. The bundler
 * currently tree-shakes its way out of trouble, but one careless edit would
 * put a Node built-in in the browser bundle and break the public site.
 *
 * Plausible enough that a bot filling every field it finds will fill this one.
 */
export const HONEYPOT_FIELD = "company_website";
