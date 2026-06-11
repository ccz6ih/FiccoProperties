# Tenant screening (TransUnion SmartMove)

**Model: applicant-pays, no SSN stored by us.** SmartMove has no public API for
small landlords, so screening is a guided-manual workflow — the portal does the
check, and our dashboard tracks status + the decision so everything is in one
place with the applicant's history.

## One-time setup
1. Create a free landlord account at **mysmartmove.com**.
2. In SmartMove's settings, choose **applicant pays** (so the ~$40 fee + SSN
   entry happen on TransUnion's side — we never collect or store SSNs).

## Per-applicant workflow
All from **Admin → Applications → click the applicant** (`/admin/applications/[id]`):

1. **Review** the application (contact, residence, employer, current landlord,
   signed authorizations, ID photo). The applicant already consented to the
   background/credit check and to contacting landlords/employer.
2. Click **Open SmartMove** → start a new screening for this applicant using
   their email. SmartMove emails them a secure link.
3. Click **Email applicant** if you want to nudge them. They pay ~$40 and enter
   their SSN directly with TransUnion.
4. Set status to **Invited** (stamps the "screening started" date).
5. When the report comes back (in your SmartMove account), open it, then in the
   **Screening** panel:
   - paste the **SmartMove report link**,
   - add **notes** (decision, ResidentScore range, flags),
   - set status to **Passed / Failed / Waived**, and **Save**.
6. Move the **application status** to **Approved** or **Denied** accordingly.
   Approved → use the **Create lease** shortcut.

## What the dashboard shows
- **Screening status** pill + the saved report link + notes, on the applicant page.
- **Applicant history**: any other applications and tour requests from the same
  email, so repeat/returning applicants are obvious.

## ⚠️ FCRA / fair housing reminders
- The signed authorization on the application covers running the report — keep it.
- If you **deny** based on the report, you must send an **adverse-action notice**
  (SmartMove provides a template). Don't skip this.
- Apply the same criteria to every applicant. Service/assistance animals are not
  pets and may be a reasonable accommodation (already worded into the app).
- Have your attorney review the consent + adverse-action process before going live.

## If you outgrow manual later
APIs exist for full automation — **RentPrep** (Stessa) and **Checkr Tenant** —
but they need a business account and are overkill until volume justifies it.
