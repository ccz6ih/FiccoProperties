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
