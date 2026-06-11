# Ficco Properties — Setup

Property management portal for the four Ficco communities on W 38th Ave,
Wheat Ridge CO. Next.js (App Router) + TypeScript + Tailwind + Supabase.

| Property | Address | Units |
|---|---|---|
| Mountain Village Square Apartments | 11500 W 38th Ave | 61 |
| Senior Villa | 11340 W 38th Ave | 43 |
| Villa Victoria | 11250 W 38th Ave | 28 (1 house) |
| The Villa | 11080 W 38th Ave | 18 |

---

## 1. Initialize the app

Run inside `C:\Projects\FiccoProperties` (the empty repo):

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
npm i @supabase/supabase-js @supabase/ssr
```

## 2. Environment

Create `.env.local` (never commit it — it's in `.gitignore` by default):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only, never expose to client
```

## 3. Database

In the Supabase SQL editor, run in order:
1. `0001_ficco_properties_schema.sql` — tables, RLS, triggers
2. `0002_properties_and_units_seed.sql` — the 4 properties + 150 units

Then generate typed bindings:

```bash
npx supabase gen types typescript --project-id YOUR-PROJECT-ID > src/types/database.ts
```

After your first signup, promote yourself to owner:

```sql
update public.profiles set role = 'owner' where email = 'you@ficcoproperties.com';
```

---

## 4. Folder structure

```
src/
  app/
    (public)/                 # no login required
      page.tsx                # marketing landing (root domain)
      properties/[slug]/page.tsx
      apply/page.tsx          # Phase 1 application funnel
    (resident)/
      portal/
        page.tsx              # my unit dashboard
        maintenance/page.tsx
        lease/page.tsx
        messages/page.tsx
    (admin)/
      admin/
        page.tsx              # admin dashboard
        applications/page.tsx # review queue
        leases/page.tsx
        maintenance/page.tsx  # board view
        units/[id]/page.tsx   # per-unit history
        residents/page.tsx
    login/page.tsx
    layout.tsx
  lib/
    supabase/client.ts
    supabase/server.ts
  types/database.ts           # generated
middleware.ts                 # session refresh + role gating
```

The three route groups map to the three audiences: `(public)` is the front
door, `(resident)` is gated to logged-in tenants, `(admin)` is gated to staff.

---

## 5. Supabase clients

`src/lib/supabase/client.ts` (browser):

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

`src/lib/supabase/server.ts` (server components / route handlers):

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )
}
```

---

## 6. Middleware — session + role gating

`middleware.ts` at the repo root. Refreshes the Supabase session on every
request, then enforces who can reach `/admin` and `/portal`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          ),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = req.nextUrl.pathname

  const needsAuth = path.startsWith('/admin') || path.startsWith('/portal')
  if (needsAuth && !user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (path.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/portal', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*', '/login'],
}
```

> Note: the `@supabase/ssr` cookie API changes occasionally — if signatures
> don't line up, check the current Supabase Next.js SSR docs and adjust the
> `cookies` handlers. The role-gating logic stays the same regardless.

---

## 7. Run

```bash
npm run dev
```

Then commit the scaffold so the repo stops being empty:

```bash
git add .
git commit -m "Scaffold: Next.js + Supabase, schema, 4 properties / 150 units"
git push origin main
```

## Build order

1. **Phase 0 — Scaffold** (this doc)
2. **Phase 1 — Applications** (the public front door)
3. **Phase 2 — Leases + e-sign**
4. **Phase 3 — Maintenance + make-ready checklists**
5. **Phase 4 — Messages + notifications**
6. **Phase 5 — Payments** (ACH-first)
