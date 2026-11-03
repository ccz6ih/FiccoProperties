# Getting email sending again

The app no longer cares which company sends its mail. Point it at any provider
that speaks SMTP — which is nearly all of them — by setting four environment
variables. No code change, no developer.

## The one thing you cannot skip

`38thaveproperties.com` publishes a **DMARC policy of `p=quarantine`**. That
tells Gmail, Yahoo and AOL to put mail in spam unless it is properly signed for
the domain. Lou is on AOL and Tony is on Yahoo, which are the strictest of the
lot.

So with any new provider you must **verify the domain and add the DNS records
they give you** before relying on it. Skipping this doesn't produce an error —
it produces notices that silently land in spam, which is worse.

DNS lives at **GoDaddy** (`ns63.domaincontrol.com`): sign in → My Products →
the domain → DNS → Add Record. Typically two or three CNAMEs for DKIM and one
TXT for SPF. Allow up to an hour, though it's usually minutes.

Old Resend records can stay for now; they do no harm and matter if the account
is ever reinstated.

## Pick a provider

Volume is about 150 emails a month, so the free tiers are generous. Any of
these can be signed up for and sending the same day:

| | Free allowance | Notes |
|---|---|---|
| **SMTP2GO** | 1,000/month | Transactional focus, quick approval, straightforward DKIM. Good first choice. |
| **Brevo** | 300/day | Free forever, easy signup. Interface is aimed at marketing but SMTP works fine. |
| **MailerSend** | 3,000/month | Good deliverability, approval can take a day. |
| **Amazon SES** | $0.10 per 1,000 | Cheapest and the least likely to ever cut you off, but the AWS console is unfriendly and you must request "production access" to leave the sandbox. Worth moving to eventually. |

All four give you an SMTP host, username and password. That's all the app needs.

## Office 365 through GoDaddy (office@38thaveproperties.com)

Workable, and it also gives the domain a real mailbox, which it has never had.
Two things make it fiddlier than a dedicated sending service, and both are
worth knowing before you start rather than after.

**SMTP AUTH is switched off by default** on mailboxes created in recent years,
and **Security Defaults — on by default for a new tenant — blocks SMTP sign-in
across the whole tenant regardless of the per-mailbox setting.** You have to
deal with both, and GoDaddy's simplified email panel may not expose either; you
may need the real Microsoft admin centre at `admin.microsoft.com`.

**It is also on a clock.** Microsoft disables basic authentication for SMTP
AUTH by default at the end of December 2026, with final removal to be announced
in the second half of 2027. An admin can re-enable it, but this is not a
setting to build on for years.

Order of work:

1. Create the mailbox `office@38thaveproperties.com` and sign in once at
   `outlook.office.com` to clear the first-run prompts.
2. In `admin.microsoft.com` → Users → Active users → **office@** → Mail →
   **Manage email apps** → tick **Authenticated SMTP** → Save.
3. Check whether **Security Defaults** is on: Microsoft Entra admin centre →
   Overview → Properties → Manage security defaults. If it's on, SMTP sign-in
   is blocked tenant-wide no matter what step 2 says.
4. Allow up to an hour for the change, occasionally longer.
5. **Turn on DKIM** — see below. With `p=quarantine` on the domain this decides
   inbox versus spam.

`EMAIL_FROM` **must be the mailbox you sign in as.** Microsoft rejects sending
as anything else with `550 5.7.60 SendAsDenied`, and it is the most common way
an otherwise-correct setup fails. `scripts/check-email.mts` warns about this
before you send.

### DKIM for Microsoft 365

GoDaddy normally adds MX, SPF and autodiscover when you buy the mailbox. DKIM
it does not — you switch that on yourself:

1. `security.microsoft.com` → Email & collaboration → Policies & rules →
   Threat policies → **Email authentication settings** → DKIM
2. Select `38thaveproperties.com` and enable signing
3. It will give you **two CNAME records** (`selector1._domainkey` and
   `selector2._domainkey`). Add both at GoDaddy, then enable again.

Check afterwards that the domain has **exactly one** SPF record at the apex,
containing `include:spf.protection.outlook.com`. Two SPF records is the same as
none. The existing Resend SPF sits on the `send.` subdomain and does not
conflict.

## Set it up

Add to `.env.local` locally, and to **Vercel → Project → Settings →
Environment Variables** for production:

```
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=587
SMTP_USER=<the username they give you>
SMTP_PASS=<the password or API key they give you>
EMAIL_FROM="Craig Carda · 38th Ave Properties <notifications@38thaveproperties.com>"
```

`EMAIL_PROVIDER` is optional. With `SMTP_HOST` and `SMTP_USER` set, SMTP is
used automatically.

**Vercel reads environment variables at deploy time.** Changing one in the
dashboard does nothing until you redeploy. This has cost an afternoon before.

## Check it before trusting it

```
npx tsx scripts/check-email.mts                  # connect and verify only
npx tsx scripts/check-email.mts craig@email.com  # and send a real test
```

Then **look in the spam folder as well as the inbox**. Which one it lands in is
the real test, and it's the DNS records that decide it.

Once live, `/admin/email-log` shows which provider is in use at the top.

## What changes with SMTP

Resend reported back when a message was delivered, opened or bounced. Plain
SMTP cannot: the server accepts the message and the conversation ends. So the
log shows **Sent ✓** as the final state rather than *Delivered*.

Bounces come back as replies to the reply-to address instead, so keep an eye on
that inbox. If you want delivery tracking back later, SES and most providers
offer webhooks — `src/app/api/webhooks/resend/route.ts` is the shape to copy.

## If Resend reinstates you

Remove the `SMTP_*` variables, or set `EMAIL_PROVIDER=resend`, and redeploy.
Nothing else needs touching.
