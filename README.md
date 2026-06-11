# Ficco Properties

Property management portal for the four Ficco communities on W 38th Ave, Wheat
Ridge CO. Public marketing site + online applications + resident portal + admin
back office.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth + RLS) · deploys on Vercel.

| Property | Address | Units |
|---|---|---|
| Mountain Village Square Apartments | 11500 W 38th Ave | 61 |
| Senior Villa | 11340 W 38th Ave | 43 |
| Villa Victoria | 11250 W 38th Ave | 28 (incl. 1 house) |
| The Villa | 11080 W 38th Ave | 18 |

## Local development

```bash
cp .env.example .env.local   # fill in your Supabase keys
npm install
npm run dev                  # http://localhost:3000
```

Required env vars (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

## Database

The schema and seed live as SQL migrations. Apply them in the Supabase SQL
editor in order:

1. `0001_ficco_properties_schema.sql` — tables, Row-Level Security, triggers
2. `0002_properties_and_units_seed.sql` — the 4 properties + 150 units

After your first sign-up, promote yourself to owner so you can reach `/admin`:

```sql
update public.profiles set role = 'owner' where email = 'you@example.com';
```

Regenerate typed bindings after schema changes:

```bash
npx supabase gen types typescript --project-id YOUR-PROJECT-ID > src/types/database.ts
```

## Routes

- `/` — marketing landing
- `/properties/[slug]` — per-community pages
- `/apply` — public application funnel (anonymous submissions allowed)
- `/login` — resident/staff auth
- `/portal` — resident dashboard (home, maintenance, lease, messages)
- `/admin` — staff back office (overview, applications, maintenance, leases, residents)

`middleware.ts` refreshes the Supabase session and gates `/portal` (any signed-in
user) and `/admin` (owner/admin roles only).

## Roles & security

Roles: `owner`, `admin`, `resident`, `applicant`. Access is enforced two ways:

- **RLS** in Postgres (the real boundary) — residents only see their own leases,
  maintenance, and conversations; staff see everything; the public can read
  properties/units and submit applications.
- **Middleware** for routing UX (redirects unauthenticated users to login,
  non-staff away from `/admin`).

The service-role key bypasses RLS and is server-only — never import it into a
client component.

## Build roadmap

- ✅ Phase 0 — Scaffold + schema + RLS
- ✅ Phase 1 — Public site + applications
- ⬜ Phase 2 — Leases + e-sign
- ⬜ Phase 3 — Maintenance make-ready checklists
- ⬜ Phase 4 — Realtime messaging + notifications
- ⬜ Phase 5 — Payments (ACH-first)
