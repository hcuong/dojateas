# Deployment Design: Cloudflare Pages + Neon

**Date:** 2026-06-09  
**Stack:** TanStack Start · Cloudflare Pages · Neon PostgreSQL  
**Deploy model:** Git integration (push to `main` → auto-deploy)

---

## Architecture

User requests hit the nearest Cloudflare edge location (~300 globally). TanStack Start SSR runs inside a CF Workers V8 isolate. The app connects to Neon PostgreSQL via HTTP (not TCP) using the `@neondatabase/serverless` driver.

```
User → Cloudflare Edge → TanStack Start SSR (CF Workers) → neon-http → Neon PostgreSQL (main branch)
```

Local dev uses the same driver but points at a separate Neon `dev` branch:

```
localhost:3000 → Vite dev server → neon-http → Neon PostgreSQL (dev branch)
```

---

## Code Changes

### 1. Install packages

```bash
npm install @neondatabase/serverless
npm install -D wrangler
npm uninstall postgres
```

### 2. `src/db/index.ts` — swap DB driver

```ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

### 3. `vite.config.ts` — add Cloudflare preset

Add `server: { preset: 'cloudflare-pages' }` to the `tanstackStart()` plugin:

```ts
tanstackStart({
  server: { preset: 'cloudflare-pages' }
})
```

### 4. New `wrangler.toml` at project root

```toml
name = "dojateas"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".output/public"
```

`nodejs_compat` is required for Better Auth's crypto internals to work inside CF Workers.

### 5. `.env.local` (local dev only, never committed)

```
DATABASE_URL=<neon dev branch connection string>
BETTER_AUTH_SECRET=<long random string>
APP_URL=http://localhost:3000
```

Also add `.env.local` to `.gitignore` — the existing `.gitignore` only covers `.env`.

---

## Neon Database Setup

Two branches, created once in the Neon dashboard:

| Branch | Purpose | Used by |
|---|---|---|
| `main` | Production data | CF Pages (via env var) |
| `dev` | Local development | `.env.local` |

Branches are copy-on-write snapshots. To reset local dev data to match production, reset the `dev` branch from `main` in the Neon dashboard.

### Migration workflow

Migrations are run manually from your local machine using `drizzle-kit`. They are never run automatically on deploy.

```bash
# Against dev branch (DATABASE_URL already set in .env.local)
npx drizzle-kit migrate

# Against production branch (before deploying a schema change)
DATABASE_URL=<neon-main-url> npx drizzle-kit migrate
```

---

## Cloudflare Pages Setup (one-time)

1. Cloudflare dashboard → **Pages** → **Connect to Git** → select `dojateas` repo
2. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `.output/public`
   - **Framework preset:** None
3. Environment variables (**Settings → Environment Variables**):
   ```
   DATABASE_URL       = <neon main branch connection string>
   BETTER_AUTH_SECRET = <same value as local>
   APP_URL            = https://dojateas.pages.dev
   ```
4. Deploy. CF Pages assigns `https://dojateas.pages.dev` automatically.
5. Optional: attach a custom domain under **Custom Domains**.

---

## Daily Workflow

**When schema has NOT changed:**
```
Write code → npm run dev → git push main → CF Pages auto-deploys
```

**When schema HAS changed:**
```
Write code → npm run dev (test against Neon dev branch)
           → npx drizzle-kit migrate (against Neon main, BEFORE pushing)
           → git push main → CF Pages auto-deploys
```

Migrations must run against production *before* the new code deploys, so the schema is ready when the new code goes live.

---

## What Is Not Changing

- All routes, components, auth logic, schema — untouched
- `drizzle.config.ts` — unchanged, still reads `DATABASE_URL`
- Better Auth configuration — unchanged
- QR code generation, batch tracing, admin panel — all work as-is
