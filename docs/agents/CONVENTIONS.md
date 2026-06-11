# Ficco Properties — Agent Build Conventions

Every phase agent MUST read this file first and follow it exactly. The goal is
that four agents can build in parallel and their output merges cleanly.

## The product

Property management portal for four family-owned communities on W 38th Ave,
Wheat Ridge CO (150 units). Audiences: **public** (marketing + apply),
**residents** (logged-in tenants), **staff** (owner/admin). Stack: Next.js 16
App Router · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + RLS).

## Golden rules

1. **Stay inside your lane.** Only create/edit files listed under "Files you
   own" in your phase spec. NEVER edit a file in the "Shared — do not touch"
   list. If you need a change there, write it to `docs/agents/integration-<phase>.md`
   as instructions for the integrator.
2. **Do not run `next build`, `next dev`, or `vercel`.** Other agents share this
   working tree and `.next/`. You MAY run `npx tsc --noEmit` to typecheck.
3. **Do not apply database migrations.** Write your migration as a `.sql` file
   only (see Migrations). The integrator applies them in order and regenerates
   types.
4. **Do not edit `src/types/database.ts`.** It is regenerated centrally. For any
   new or extended table, type your query results locally with `.returns<T>()`
   (see Data access).
5. **Match the existing code.** Read 3–4 existing files before writing. Mirror
   their imports, naming, and density. No new dependencies without noting it in
   your integration file.

## Design system (already defined in `globals.css` — use these tokens)

Colors (Tailwind utilities): `cream` (bg), `sand`, `clay`, `clay-deep`, `ink`
(text), `ink-soft`, `ink-faint`, `pine`/`pine-dark`/`pine-soft` (primary),
`terracotta`/`terracotta-dark`/`terracotta-soft` (accent), `gold`.
Fonts: headings use `font-display` (serif), body is default sans.
Radius: cards `rounded-2xl`, inputs/buttons `rounded-xl`/`rounded-full`.

Reuse these components — DO NOT recreate them:
- `@/components/ui` → `Container`, `Button`, `ButtonLink`, `Card`, `Badge`,
  `Eyebrow`, `cn`
- `@/components/dashboard-ui` → `PageHeader`, `StatCard`, `EmptyState`,
  `StatusPill` (renders status enums with the right tone)
- `@/lib/format` → `formatCents`, `formatDate`, `humanize`, `propertyTypeLabel`

Standard input class (copy verbatim for form fields):
```
"w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
```

If you need a new status value rendered by `StatusPill`, add it to your
integration file (the integrator extends `statusTones`); meanwhile your code can
still pass it — unknown values render with a neutral tone.

## Supabase clients

- Server components / route handlers / server actions:
  `import { createClient } from "@/lib/supabase/server"` then `await createClient()`.
- Browser/client components:
  `import { createClient } from "@/lib/supabase/client"`.
- Auth helper: `import { requireProfile, isStaff } from "@/lib/auth"`.
  `requireProfile(path)` returns `{ user, profile }` or redirects to login.

## Data access pattern

Because `database.ts` is regenerated centrally, decouple from it: define a local
type for any query touching new/changed tables and cast with `.returns<T[]>()`:

```ts
type PaymentRow = {
  id: string; amount_cents: number; status: string;
  leases: { id: string } | null;
};
const { data } = await supabase
  .from("payments")
  .select("*, leases(id)")
  .returns<PaymentRow[]>();
```

For inserts/updates on new tables, the typed client won't know them yet. Use a
loosely-typed handle in server actions to avoid build breaks:
```ts
const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
await db.from("payments").insert({ ... });
```
(The integrator tightens these after regenerating types.)

## Migrations

Write ONE file: `supabase/migrations/<NNNN>_<name>.sql` using the number in your
spec. Conventions, matching `0001`:
- `create table if not exists public.<name> (...)` with `id uuid primary key
  default gen_random_uuid()`, `created_at timestamptz not null default now()`,
  and `updated_at` + the `set_updated_at()` trigger where rows change.
- Foreign keys reference existing tables: `properties`, `units`, `profiles`,
  `leases`, `applications`, `maintenance_requests`, `conversations`, `messages`.
- **Enable RLS and write policies.** Reuse `public.is_staff()`. Pattern:
  residents see/write only their own rows (via `created_by = auth.uid()` or a
  join to a lease/profile they own); staff (`public.is_staff()`) see/write all;
  the public gets access only where explicitly required.
- Money is stored as integer cents (`*_cents int`). Never floats.
- Add indexes on every foreign key and on columns you filter by.

## RLS expectations (the real security boundary)

- A resident must never be able to read another resident's lease, payment,
  maintenance, or message rows. Test your policy logic mentally against that.
- Staff-only mutations must check `public.is_staff()` in `with check`, not just
  `using`.
- The service-role key bypasses RLS and is server-only — never reference it in a
  client component.

## Routing

Route groups already exist: `(public)`, `(resident)/portal`, `(admin)/admin`.
Add your pages under the correct group. Nav links into your new pages are wired
by the integrator — list them in your integration file. Each dashboard page body
starts with `<PageHeader title=... subtitle=... />` and is wrapped in
`<div className="mx-auto max-w-5xl">` (or `max-w-6xl` for tables).

## Deliverables for every phase

1. Your migration `.sql` file.
2. Your pages, components, and server actions (inside your lane).
3. `docs/agents/integration-<phase>.md` containing:
   - Nav links to add (label + href + which layout).
   - New `StatusPill` statuses/tones, new env vars, new dependencies.
   - The order-sensitive notes the integrator needs (e.g. "depends on a
     `leases` row existing").
   - Anything in a shared file you wished you could change.
4. A short summary (returned as your final message) of what you built and any
   assumptions.

## Definition of done

- `npx tsc --noEmit` passes for the files you wrote (run it; fix your own type
  errors using the local-type pattern above).
- Every new table has RLS enabled with policies.
- UI uses existing tokens/components and looks consistent with the current site.
- No edits to shared/do-not-touch files; all cross-cutting needs are in your
  integration file.
