# Email setup — Ficco Properties

Two separate jobs that don't conflict if MX points at **one** mail host:

| Job | Handled by | DNS it touches |
|---|---|---|
| **Receiving** `hello@`, `maintenance@` | SiteGround mailboxes/forwarders | root **MX** |
| **Sending as** `hello@` (replies look branded) | Gmail "Send mail as" + SiteGround SMTP | (none new) |
| **App notifications** (new application / tour) | **Resend** | `send` subdomain + `resend._domainkey` |

## Recommended: SiteGround + Gmail (live in Gmail, look like the domain)

1. **SiteGround → Email**: create `hello@ficcoproperties.com` and
   `maintenance@ficcoproperties.com` (mailboxes, or forwarders →
   craigcarda2@gmail.com).
2. **Point MX** for ficcoproperties.com at SiteGround (value from SiteGround).
   Add it wherever DNS is managed — likely **GoDaddy DNS** unless nameservers
   were moved to Vercel/SiteGround.
3. **Gmail → Settings → Accounts → "Send mail as"**: add
   `hello@ficcoproperties.com` using SiteGround's outgoing SMTP. Repeat for
   `maintenance@`. Now you compose/reply *as* the domain from Gmail; incoming
   domain mail lands in Gmail.

## ⚠️ Conflict to avoid
Because MX points at SiteGround for receiving, **do NOT enable Resend's
"Enable Receiving"** (the `@` MX → amazonaws record). MX can only point to one
place. In Resend, add only:
- ✅ **DKIM** TXT `resend._domainkey`
- ✅ **SPF** MX `send` + TXT `send`
- ❌ skip the **Enable Receiving** root MX

These Resend records live on the `send` subdomain and coexist with SiteGround.

## App env vars (in Vercel — already set)
- `RESEND_API_KEY` — set
- `NOTIFY_EMAIL=craigcarda2@gmail.com` — where new-application/tour alerts go
- `EMAIL_FROM=Ficco Properties <onboarding@resend.dev>` — **temporary**

### After ficcoproperties.com shows **Verified** in Resend
Switch the sender to the brand and (optionally) route alerts to the shared inbox:
- `EMAIL_FROM` → `Ficco Properties <notifications@ficcoproperties.com>`
- `NOTIFY_EMAIL` → `hello@ficcoproperties.com` (optional)
Then redeploy. (Until verified, `onboarding@resend.dev` only delivers to your
own Resend account email — fine for testing.)

## Alternatives
- **Google Workspace** (~$6/user/mo): real Gmail on the domain, best UX, paid.
- **GoDaddy email forwarding**: works, but SiteGround is the preferred free option here.
