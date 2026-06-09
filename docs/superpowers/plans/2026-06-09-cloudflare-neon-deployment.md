# Cloudflare Pages + Neon Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Dojateas TanStack Start app to Cloudflare Pages using Neon PostgreSQL, with a separate Neon `dev` branch for local development.

**Architecture:** Swap the TCP-based `postgres` driver for `@neondatabase/serverless` (HTTP), add the `cloudflare-pages` preset to the TanStack Start Vite plugin, and add a `wrangler.toml` for CF build configuration. No route, auth, or schema code changes.

**Tech Stack:** TanStack Start · Cloudflare Pages · Neon PostgreSQL · `@neondatabase/serverless` · `drizzle-orm/neon-http` · Wrangler

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `.gitignore` | Add `.env.local` |
| Modify | `package.json` | Add `@neondatabase/serverless`, `wrangler`; remove `postgres` |
| Modify | `src/db/index.ts` | Swap postgres driver → neon-http |
| Modify | `vite.config.ts` | Add `server: { preset: 'cloudflare-pages' }` |
| Create | `wrangler.toml` | CF build config |

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

## Task 5: Add the Cloudflare Pages preset to vite.config.ts

**Files:**
- Modify: `vite.config.ts`

The `cloudflare-pages` preset tells TanStack Start to produce a CF Workers-compatible bundle and output static assets to `.output/public`.

- [ ] **Step 1: Update vite.config.ts**

Replace the entire file with:

```ts
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({ server: { preset: 'cloudflare-pages' } }),
    viteReact(),
  ],
})

export default config
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add cloudflare-pages preset to TanStack Start"
```

---

## Task 6: Create wrangler.toml

**Files:**
- Create: `wrangler.toml`

`wrangler.toml` tells Cloudflare where to find the build output and which runtime flags to enable. `nodejs_compat` is required for Better Auth's crypto internals to run inside CF Workers.

- [ ] **Step 1: Create wrangler.toml at project root**

```toml
name = "dojateas"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".output/public"
```

- [ ] **Step 2: Commit**

```bash
git add wrangler.toml
git commit -m "chore: add wrangler.toml for Cloudflare Pages config"
```

---

## Task 7: Verify the production build

**Files:** none (verification only)

- [ ] **Step 1: Run the production build**

```bash
npm run build
```

Expected: build completes with no errors. You should see output referencing the cloudflare-pages preset and a final success line.

If the build fails with a `postgres` module error, verify `src/db/index.ts` no longer imports from `postgres` (Task 4).

If the build fails with a `nodejs_compat` or crypto error, verify `wrangler.toml` is present and committed (Task 6).

- [ ] **Step 2: Confirm the output directory exists**

```bash
ls .output/public
```

Expected: directory exists and contains at least a `_worker.js` file and static assets.

- [ ] **Step 3: Run tests one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

---

## Task 8: Cloudflare Pages setup (manual, one-time)

This task has no code changes — it's done in the Cloudflare dashboard. Complete after Task 7's git push so the latest code is on GitHub.

- [ ] **Step 1: Connect your GitHub repo**

Go to cloudflare.com → **Pages** → **Create a project** → **Connect to Git**. Authorize GitHub and select the `dojateas` repository.

- [ ] **Step 2: Configure the build**

In the build settings:
- **Framework preset:** None
- **Build command:** `npm run build`
- **Build output directory:** `.output/public`

- [ ] **Step 3: Add environment variables**

Under **Settings → Environment Variables**, add these for the **Production** environment:

```
DATABASE_URL       = <neon main branch pooled connection string>
BETTER_AUTH_SECRET = <same value as BETTER_AUTH_SECRET in your .env.local>
APP_URL            = https://dojateas.pages.dev
```

- [ ] **Step 4: Deploy**

Click **Save and Deploy**. Watch the build log. The first deploy takes ~2 minutes.

If it fails, check:
- Build log for the specific error message
- That all three environment variables are set correctly
- That `wrangler.toml` is committed and `pages_build_output_dir` is `.output/public`

- [ ] **Step 5: Verify the live app**

Open `https://dojateas.pages.dev`. Navigate to `/admin/login` and confirm the login page loads. Log in and verify you can reach the admin panel.

---

## Future deploys

Every `git push origin main` triggers an automatic CF Pages build and deploy. No manual steps needed unless the database schema changes.

**When schema changes — run migrations against Neon main BEFORE pushing:**

```bash
DATABASE_URL=<neon main branch pooled connection string> npx drizzle-kit migrate
git push origin main
```
