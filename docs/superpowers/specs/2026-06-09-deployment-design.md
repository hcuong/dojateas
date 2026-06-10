# Deployment Design: Cloudflare Workers + Neon

**Date:** 2026-06-09  
**Stack:** TanStack Start · Cloudflare Workers (+ Assets) · Neon PostgreSQL  
**Deploy model:** GitHub Actions (push to `main` → build → `wrangler deploy`)

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

### 3. `vite.config.ts` — unchanged

`tanstackStart()` is used with no preset. TanStack Start v1's plugin schema has no `server.preset` option — it was tried and confirmed to be silently ignored (build output stayed in `dist/`, not `.output/public`). The plain build already produces what's needed:

- `dist/client/` — static assets
- `dist/server/server.js` — SSR handler, default export is `(request: Request) => Promise<Response>`

### 4. New `workers/entry.js` — CF Workers thin wrapper

CF Workers requires a default export shaped like `{ fetch(request, env, ctx) {} }`. TanStack Start's handler is a plain function, so a thin wrapper bridges the two:

```js
import handler from '../dist/server/server.js'

export default {
  fetch(request) {
    return handler(request)
  },
}
```

### 5. New `wrangler.toml` at project root

```toml
name = "dojateas"
main = "workers/entry.js"
compatibility_date = "2026-06-10"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "dist/client"
binding = "ASSETS"
```

`nodejs_compat` is required for `node:async_hooks` (used by TanStack Start's SSR handler) and Better Auth's crypto internals to work inside CF Workers.

### 6. New `.github/workflows/deploy.yml`

On push to `main`: `npm ci` → `npm run build` → `wrangler deploy` (via `cloudflare/wrangler-action@v3`). Replaces CF Pages' git integration, which doesn't apply to the Workers deploy model.

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

## Cloudflare Workers Setup (one-time)

1. Get your Account ID from the Cloudflare dashboard (**Workers & Pages → Overview**)
2. Create an API token (**My Profile → API Tokens**, "Edit Cloudflare Workers" template)
3. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repo secrets
4. Set Worker secrets locally (one-time, persist across deploys):
   ```bash
   npx wrangler secret put DATABASE_URL       # Neon main branch connection string
   npx wrangler secret put BETTER_AUTH_SECRET # same value as local
   npx wrangler secret put APP_URL            # https://dojateas.<subdomain>.workers.dev
   ```
5. Push to `main` — GitHub Actions runs `npm run build` + `wrangler deploy`. First deploy assigns `https://dojateas.<subdomain>.workers.dev` automatically.
6. Optional: attach a custom domain under **Workers & Pages → dojateas → Settings → Domains & Routes**.

---

## Daily Workflow

**When schema has NOT changed:**
```
Write code → npm run dev → git push main → GitHub Actions builds + deploys
```

**When schema HAS changed:**
```
Write code → npm run dev (test against Neon dev branch)
           → npx drizzle-kit migrate (against Neon main, BEFORE pushing)
           → git push main → GitHub Actions builds + deploys
```

Migrations must run against production *before* the new code deploys, so the schema is ready when the new code goes live.

---

## What Is Not Changing

- All routes, components, auth logic, schema — untouched
- `drizzle.config.ts` — unchanged, still reads `DATABASE_URL`
- Better Auth configuration — unchanged
- QR code generation, batch tracing, admin panel — all work as-is
