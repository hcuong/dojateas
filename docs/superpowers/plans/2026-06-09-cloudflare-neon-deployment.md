# Cloudflare Workers + Neon Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Dojateas TanStack Start app to Cloudflare Workers using Neon PostgreSQL, with a separate Neon `dev` branch for local development.

**Architecture:** Swap the TCP-based `postgres` driver for `@neondatabase/serverless` (HTTP). TanStack Start's plain `tanstackStart()` plugin builds `dist/client` (static assets) and `dist/server/server.js` (an SSR handler exported as a function). A thin wrapper at `workers/entry.js` adapts that function into the `{ fetch(request) {} }` shape Cloudflare Workers requires. `wrangler.toml` points `main` at the wrapper and serves `dist/client` via the Workers Assets binding. GitHub Actions runs `npm run build` + `wrangler deploy` on push to `main`. No route, auth, or schema code changes.

**Tech Stack:** TanStack Start · Cloudflare Workers (+ Assets) · Neon PostgreSQL · `@neondatabase/serverless` · `drizzle-orm/neon-http` · Wrangler · GitHub Actions

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `.gitignore` | Add `.env.local` |
| Modify | `package.json` | Add `@neondatabase/serverless`, `wrangler`; remove `postgres` |
| Modify | `src/db/index.ts` | Swap postgres driver → neon-http |
| Create | `workers/entry.js` | Thin wrapper adapting TanStack Start's handler to CF Workers' `fetch` export |
| Create | `wrangler.toml` | Worker entry + assets config |
| Create | `.github/workflows/deploy.yml` | Build + `wrangler deploy` on push to `main` |

---

## Task 1: Add .env.local to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add the entry**

Open `.gitignore` and add this line after the existing `.env` line:

```
.env.local
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .env.local to gitignore"
```

---

## Task 2: Neon account and branch setup (manual, one-time)

This task has no code changes — it's done in the Neon dashboard. Complete this before Task 3 so tests can run against a real database.

- [ ] **Step 1: Create a Neon account and project**

Go to neon.tech, sign up, and create a new project. Name it `dojateas`. Select the region closest to your users (e.g., Singapore `ap-southeast-1` for Vietnam).

- [ ] **Step 2: Run migrations against the main branch**

The default branch in Neon is `main`. Copy its **pooled** connection string from the dashboard (the one containing `-pooler` in the hostname). Run:

```bash
DATABASE_URL=<neon main branch pooled connection string> npx drizzle-kit migrate
```

Expected output: migrations `0000_wet_azazel.sql` and `0001_little_tiger_shark.sql` apply successfully.

- [ ] **Step 3: Create the dev branch**

In the Neon dashboard, go to **Branches** → **New Branch**. Name it `dev`, branched from `main`. Because you branch after running migrations, the `dev` branch already has the full schema — no need to run migrations again.

- [ ] **Step 4: Create .env.local at project root**

Copy the **pooled** connection string for the `dev` branch from the Neon dashboard. Generate a secret:

```bash
openssl rand -base64 32
```

Create `.env.local` with:

```
DATABASE_URL=<neon dev branch pooled connection string>
BETTER_AUTH_SECRET=<output from openssl command above>
APP_URL=http://localhost:3000
```

---

## Task 3: Swap the database driver packages

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install the new driver and Wrangler CLI**

```bash
npm install @neondatabase/serverless
npm install -D wrangler
```

- [ ] **Step 2: Remove the old driver**

```bash
npm uninstall postgres
```

- [ ] **Step 3: Verify postgres is gone from package.json**

```bash
grep '"postgres"' package.json
```

Expected: no output (no match).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap postgres driver for @neondatabase/serverless"
```

---

## Task 4: Swap the DB driver in src/db/index.ts

**Files:**
- Modify: `src/db/index.ts`

The existing code uses `drizzle-orm/postgres-js` which opens a raw TCP socket — incompatible with Cloudflare Workers. Replace it with `drizzle-orm/neon-http` which connects via HTTP. The Drizzle query API is identical either way (`db.select()`, `db.insert()`, `db.query.*`, etc.), so no other files change.

- [ ] **Step 1: Run the existing tests to confirm the baseline passes**

```bash
npm test
```

Expected: all tests in `src/db/queries/products.test.ts` and `src/db/queries/batches.test.ts` pass. This confirms `.env.local` is correctly pointing at the Neon dev branch.

If tests fail with a connection error, verify the `DATABASE_URL` in `.env.local` is the Neon dev branch pooled string and the Neon project is active.

- [ ] **Step 2: Replace the contents of src/db/index.ts**

```ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

- [ ] **Step 3: Run the tests again to verify driver compatibility**

```bash
npm test
```

Expected: same tests pass as in Step 1. The neon-http driver supports all Drizzle operations used in the codebase: `db.select`, `db.insert`, `db.update`, `db.delete`, `db.query.*.findFirst`.

- [ ] **Step 4: Commit**

```bash
git add src/db/index.ts
git commit -m "feat: swap postgres driver to neon-http for CF Workers compatibility"
```

---

## Task 5: Revert the cloudflare-pages preset (DONE)

**Files:**
- Modify: `vite.config.ts`

> **Status: already completed and committed (`dbb3c04`).** Recorded here for plan accuracy — `server: { preset: 'cloudflare-pages' }` is not part of TanStack Start v1's plugin schema (the type only exposes `server.build.inlineCss`) and was silently ignored: the build output stayed in `dist/`, not `.output/public`. `vite.config.ts` was reverted to the plain config:

```ts
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
```

`npm run build` produces:
- `dist/client/` — static assets (JS/CSS chunks, favicon, manifest, etc.), no `index.html`
- `dist/server/server.js` — SSR handler, `export default` is a function `(request: Request) => Promise<Response>`

---

## Task 6: Cloudflare Workers entry wrapper + wrangler.toml (DONE)

**Files:**
- Create: `workers/entry.js`
- Create: `wrangler.toml`

> **Status: already completed and committed (`a0c7500`), verified with `npx wrangler deploy --dry-run`.** Recorded here for plan accuracy.

CF Workers requires a default export shaped like `{ fetch(request, env, ctx) {} }`, but TanStack Start's `dist/server/server.js` exports a plain function. `workers/entry.js` bridges the two:

```js
import handler from '../dist/server/server.js'

export default {
  fetch(request) {
    return handler(request)
  },
}
```

`wrangler.toml` points `main` at this wrapper and serves `dist/client` as static assets. `nodejs_compat` is required for `node:async_hooks` (used by TanStack Start's SSR handler) and Better Auth's crypto internals.

```toml
name = "dojateas"
main = "workers/entry.js"
compatibility_date = "2026-06-10"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "dist/client"
binding = "ASSETS"
```

Verification performed: `npm run build` then `npx wrangler deploy --dry-run` — output showed the worker bundled from `workers/entry.js`, 27 files read from `dist/client`, and `env.ASSETS` bound. No "No bindings found" warning (the failure mode of the earlier `@cloudflare/vite-plugin`-generated config).

---

## Task 7: Verify the production build

**Files:** none (verification only)

- [ ] **Step 1: Run the production build**

```bash
npm run build
```

Expected: build completes with no errors, ending with a Vite build summary listing `dist/server/server.js` and `dist/client/assets/*`.

If the build fails with a `postgres` module error, verify `src/db/index.ts` no longer imports from `postgres` (Task 4).

- [ ] **Step 2: Confirm the output directories exist**

```bash
ls dist/client && ls dist/server
```

Expected: `dist/client` contains `assets/` plus static files (favicon, manifest, etc.); `dist/server` contains `server.js` and `assets/`.

- [ ] **Step 3: Dry-run the Cloudflare Worker deploy**

```bash
npx wrangler deploy --dry-run
```

Expected: output ends with `Total Upload: ...` and lists `env.ASSETS` under "Your Worker has access to the following bindings". No "No bindings found" or "redirected configuration path does not exist" errors.

If you see a redirect error referencing `.wrangler/deploy/config.json`, run `rm -rf .wrangler` and retry — this is a stale cache from a previous config.

- [ ] **Step 4: Run tests one final time**

```bash
npm test
```

Expected: all tests pass. Requires `.env.local` from Task 2.

- [ ] **Step 5: Push to GitHub**

```bash
git push origin main
```

This triggers `.github/workflows/deploy.yml` (Task 8), which builds and runs `wrangler deploy`. The first run will fail until Task 8's secrets are configured — that's expected.

---

## Task 8: Cloudflare Workers + GitHub Actions deploy setup (manual, one-time)

This task has no application code changes — `.github/workflows/deploy.yml` already exists. The remaining steps configure Cloudflare and GitHub so that workflow can deploy.

- [ ] **Step 1: Get your Cloudflare Account ID**

Go to the Cloudflare dashboard → **Workers & Pages** → **Overview**. Your Account ID is shown in the right sidebar. Copy it.

- [ ] **Step 2: Create a Cloudflare API token**

Go to **My Profile → API Tokens → Create Token**. Use the **"Edit Cloudflare Workers"** template, scoped to your account. Copy the generated token (shown once).

- [ ] **Step 3: Add GitHub repository secrets**

In the GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, add:

```
CLOUDFLARE_API_TOKEN  = <token from Step 2>
CLOUDFLARE_ACCOUNT_ID = <account ID from Step 1>
```

- [ ] **Step 4: Set production secrets on the Worker**

Run these locally (requires `npx wrangler login` once if not already authenticated):

```bash
npx wrangler secret put DATABASE_URL
# paste: Neon main branch pooled connection string

npx wrangler secret put BETTER_AUTH_SECRET
# paste: same value as BETTER_AUTH_SECRET in your .env.local

npx wrangler secret put APP_URL
# paste: https://dojateas.<your-workers-subdomain>.workers.dev
```

`wrangler secret put` creates the worker on first use if it doesn't exist yet. Worker secrets persist across deploys — you only set these once (or when values change).

For the `APP_URL` value: if you don't know your `*.workers.dev` subdomain yet, run `npx wrangler deploy` once first (Step 5) — the deploy output prints the URL — then set `APP_URL` afterward and redeploy.

- [ ] **Step 5: Trigger the first deploy**

Push any commit to `main` (or re-run the failed workflow from Task 7 Step 5 in the GitHub Actions tab).

```bash
git push origin main
```

Watch the **Actions** tab. The workflow runs `npm ci`, `npm run build`, then `wrangler deploy`.

If it fails, check:
- The Actions log for the specific error message
- That both repository secrets from Step 3 are set correctly
- That `npx wrangler whoami` (run locally) shows the same account as `CLOUDFLARE_ACCOUNT_ID`

- [ ] **Step 6: Verify the live app**

Open `https://dojateas.<your-workers-subdomain>.workers.dev`. Navigate to `/admin/login` and confirm the login page loads. Log in and verify you can reach the admin panel.

---

## Future deploys

Every `git push origin main` triggers `.github/workflows/deploy.yml`, which builds and runs `wrangler deploy`. No manual steps needed unless the database schema changes.

**When schema changes — run migrations against Neon main BEFORE pushing:**

```bash
DATABASE_URL=<neon main branch pooled connection string> npx drizzle-kit migrate
git push origin main
```
