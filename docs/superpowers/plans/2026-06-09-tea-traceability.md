# Dojateas Tea Traceability System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TanStack Start monolith with a brand landing page, QR-based tea traceability pages for consumers, and an internal admin panel for staff to manage products, batches, and QR codes.

**Architecture:** Single TanStack Start (SSR) app using file-based routing. PostgreSQL via Drizzle ORM. Better Auth for admin email/password authentication. QR codes generated server-side. Route loaders + `createServerFn` for data mutations.

**Tech Stack:** TanStack Start, TanStack Router (file-based), Drizzle ORM + `postgres` driver, PostgreSQL, Better Auth, Tailwind CSS v4, shadcn/ui, `qrcode`, Vitest.

---

## File Map

```
dojateas/
├── app/
│   ├── routes/
│   │   ├── __root.tsx                      # HTML shell, global styles
│   │   ├── index.tsx                       # / — Landing page
│   │   ├── trace.$batchId.tsx              # /trace/:batchId — Public trace page
│   │   ├── admin.tsx                       # /admin layout + auth guard (beforeLoad)
│   │   ├── admin.login.tsx                 # /admin/login
│   │   ├── admin.index.tsx                 # /admin dashboard
│   │   ├── admin.products.index.tsx        # /admin/products list
│   │   ├── admin.products.new.tsx          # /admin/products/new
│   │   ├── admin.batches.index.tsx         # /admin/batches list
│   │   ├── admin.batches.new.tsx           # /admin/batches/new
│   │   ├── admin.batches.$id.tsx           # /admin/batches/:id — edit + details
│   │   ├── admin.qr.$id.tsx                # /admin/qr/:id — view & download QR
│   │   └── api/
│   │       ├── auth/$.ts                   # Better Auth handler
│   │       └── qr.$batchId.ts              # PNG download endpoint
│   ├── components/
│   │   ├── RecallBanner.tsx                # Red warning for recalled batches
│   │   └── BatchDetailCard.tsx             # Key-value detail display
│   ├── db/
│   │   ├── index.ts                        # postgres + drizzle instance
│   │   ├── schema.ts                       # All table definitions (app + auth)
│   │   └── queries/
│   │       ├── products.ts                 # Product CRUD functions
│   │       ├── products.test.ts
│   │       ├── batches.ts                  # Batch + batch_details CRUD functions
│   │       └── batches.test.ts
│   └── lib/
│       ├── auth.ts                         # Better Auth server config + getAdminSession
│       └── auth-client.ts                  # Better Auth React client
├── scripts/
│   └── seed-admin.ts                       # One-time admin user seeder
├── drizzle/                                # Migration files (generated)
├── drizzle.config.ts
├── vitest.config.ts
├── app.config.ts
└── .env
```

---

## Task 1: Scaffold project & install dependencies

**Files:**
- Create: project root via CLI, `vitest.config.ts`, `.env`, `.env.example`

- [ ] **Step 1: Scaffold TanStack Start project**

```bash
npm create tanstack@latest dojateas
# When prompted: framework=Start, variant=React, TypeScript, file-based routing
cd dojateas
```

- [ ] **Step 2: Install additional dependencies**

```bash
npm install drizzle-orm postgres better-auth qrcode
npm install -D drizzle-kit @types/qrcode vitest
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
})
```

> Note: install `vite-tsconfig-paths` if not already present: `npm install -D vite-tsconfig-paths`

- [ ] **Step 4: Create `.env`**

```
DATABASE_URL=postgres://postgres:password@localhost:5432/dojateas
BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

- [ ] **Step 5: Create `.env.example`**

```
DATABASE_URL=postgres://user:password@localhost:5432/dojateas
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

- [ ] **Step 6: Create local PostgreSQL database**

```bash
psql -U postgres -c "CREATE DATABASE dojateas;"
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```
Expected: Server running at `http://localhost:3000`, no errors in terminal.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: scaffold TanStack Start project with dependencies"
```

---

## Task 2: Drizzle schema + database setup

**Files:**
- Create: `drizzle.config.ts`
- Create: `app/db/index.ts`
- Create: `app/db/schema.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './app/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 2: Create `app/db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

- [ ] **Step 3: Create `app/db/schema.ts`** (app tables; auth tables added in Task 3)

```ts
import { pgTable, uuid, text, date, integer, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const batches = pgTable('batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id),
  harvestDate: date('harvest_date').notNull(),
  productionDate: date('production_date').notNull(),
  expiryDate: date('expiry_date').notNull(),
  quantity: integer('quantity').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'recalled'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const batchDetails = pgTable('batch_details', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull().references(() => batches.id),
  key: text('key').notNull(),
  value: text('value').notNull(),
  mediaUrl: text('media_url'),
})

export const productsRelations = relations(products, ({ many }) => ({
  batches: many(batches),
}))

export const batchesRelations = relations(batches, ({ one, many }) => ({
  product: one(products, {
    fields: [batches.productId],
    references: [products.id],
  }),
  details: many(batchDetails),
}))

export const batchDetailsRelations = relations(batchDetails, ({ one }) => ({
  batch: one(batches, {
    fields: [batchDetails.batchId],
    references: [batches.id],
  }),
}))
```

- [ ] **Step 4: Generate initial migration**

```bash
npx drizzle-kit generate
```
Expected: Migration file created in `drizzle/`

- [ ] **Step 5: Apply migration**

```bash
npx drizzle-kit migrate
```
Expected: Tables `products`, `batches`, `batch_details` created in DB

- [ ] **Step 6: Verify tables exist**

```bash
psql $DATABASE_URL -c "\dt"
```
Expected: output lists `products`, `batches`, `batch_details`

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add Drizzle schema and initial migration"
```

---

## Task 3: Better Auth setup

**Files:**
- Create: `app/lib/auth.ts`
- Create: `app/lib/auth-client.ts`
- Modify: `app/db/schema.ts` (append auth tables)
- Create: `app/routes/api/auth/$.ts`
- Create: `scripts/seed-admin.ts`

- [ ] **Step 1: Create `app/lib/auth.ts`**

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createServerFn } from '@tanstack/start'
import { getWebRequest } from 'vinxi/http'
import { db } from '~/db'
import * as schema from '~/db/schema'

export const auth = betterAuth({
  emailAndPassword: { enabled: true },
  database: drizzleAdapter(db, { provider: 'pg', schema }),
})

export const getAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getWebRequest()
  return auth.api.getSession({ headers: request.headers })
})
```

- [ ] **Step 2: Generate Better Auth Drizzle schema**

```bash
npx @better-auth/cli@latest generate
```

This outputs Drizzle table definitions for `user`, `session`, `account`, `verification`. Copy the generated tables and append them to the bottom of `app/db/schema.ts`.

- [ ] **Step 3: Run migration for auth tables**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```
Expected: Auth tables (`user`, `session`, `account`, `verification`) created in DB

- [ ] **Step 4: Create `app/lib/auth-client.ts`**

```ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()
```

- [ ] **Step 5: Create `app/routes/api/auth/$.ts`**

```ts
import { createAPIFileRoute } from '@tanstack/start/api'
import { auth } from '~/lib/auth'

export const APIRoute = createAPIFileRoute('/api/auth/$')({
  GET: ({ request }) => auth.handler(request),
  POST: ({ request }) => auth.handler(request),
})
```

- [ ] **Step 6: Verify auth endpoint responds**

```bash
curl http://localhost:3000/api/auth/ok
```
Expected: `{"status":"ok"}`

- [ ] **Step 7: Create `scripts/seed-admin.ts`**

```ts
import { auth } from '../app/lib/auth'

await auth.api.signUpEmail({
  body: {
    email: 'admin@dojateas.vn',
    password: 'changeme123',
    name: 'Admin',
  },
})
console.log('Admin user created: admin@dojateas.vn / changeme123')
process.exit(0)
```

- [ ] **Step 8: Run seeder**

```bash
npx tsx scripts/seed-admin.ts
```
Expected: `Admin user created: admin@dojateas.vn / changeme123`

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: add Better Auth with email/password and admin seed script"
```

---

## Task 4: Root layout + admin login page

**Files:**
- Modify: `app/routes/__root.tsx`
- Create: `app/routes/admin.login.tsx`

- [ ] **Step 1: Update `app/routes/__root.tsx`**

```tsx
import { createRootRoute, Outlet, ScrollRestoration } from '@tanstack/react-router'
import { Meta, Scripts } from '@tanstack/start'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Dojateas — Trà sạch từ nguồn' },
    ],
  }),
  component: () => (
    <html lang="vi">
      <head>
        <Meta />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  ),
})
```

- [ ] **Step 2: Create `app/routes/admin.login.tsx`**

```tsx
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/admin/login')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error: signInError } = await authClient.signIn.email({ email, password })
    if (signInError) {
      setError('Email hoặc mật khẩu không đúng')
      return
    }
    router.navigate({ to: '/admin' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Dojateas Admin</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <button type="submit" className="w-full bg-green-700 text-white py-2 rounded hover:bg-green-800">
          Đăng nhập
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Navigate to `http://localhost:3000/admin/login`. Form renders. Submit with wrong credentials → error message appears. Submit with `admin@dojateas.vn` / `changeme123` → navigates away (404 on `/admin` is fine for now).

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add root layout and admin login page"
```

---

## Task 5: Admin layout with auth guard

**Files:**
- Create: `app/routes/admin.tsx`
- Create: `app/routes/admin.index.tsx`

- [ ] **Step 1: Create `app/routes/admin.tsx`**

```tsx
import { createFileRoute, Outlet, redirect, Link, useRouter } from '@tanstack/react-router'
import { getAdminSession } from '~/lib/auth'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getAdminSession()
    if (!session) throw redirect({ to: '/admin/login' })
    return { session }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.navigate({ to: '/admin/login' })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-green-800 text-white px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">Dojateas Admin</span>
        <div className="flex gap-4 items-center text-sm">
          <Link to="/admin/products" className="hover:underline">Sản phẩm</Link>
          <Link to="/admin/batches" className="hover:underline">Lô hàng</Link>
          <button onClick={handleSignOut} className="opacity-75 hover:opacity-100">Đăng xuất</button>
        </div>
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/routes/admin.index.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

function AdminDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <Link to="/admin/products" className="block p-6 bg-white rounded shadow hover:shadow-md text-center font-medium">
          Sản phẩm
        </Link>
        <Link to="/admin/batches" className="block p-6 bg-white rounded shadow hover:shadow-md text-center font-medium">
          Lô hàng
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

1. While logged out, navigate to `http://localhost:3000/admin` → should redirect to `/admin/login`
2. Log in → should land on `/admin` dashboard with nav bar

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add admin layout with auth guard and dashboard"
```

---

## Task 6: Landing page

**Files:**
- Modify: `app/routes/index.tsx`

- [ ] **Step 1: Update `app/routes/index.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen">
      <section className="bg-green-900 text-white py-24 px-6 text-center">
        <h1 className="text-5xl font-bold mb-4">Dojateas</h1>
        <p className="text-xl text-green-200 mb-6">Trà sạch — Nguồn gốc minh bạch</p>
        <p className="text-green-300 max-w-lg mx-auto">
          Mỗi hộp trà đều mang một câu chuyện. Quét QR code để biết trà của bạn đến từ đâu,
          được thu hái ngày nào, và qua những công đoạn gì.
        </p>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-10">Cách hoạt động</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl mb-3">📦</div>
            <h3 className="font-semibold mb-2">1. Mua hộp trà</h3>
            <p className="text-gray-600">Tìm mã QR trên hộp sản phẩm</p>
          </div>
          <div>
            <div className="text-4xl mb-3">📱</div>
            <h3 className="font-semibold mb-2">2. Quét QR</h3>
            <p className="text-gray-600">Dùng camera điện thoại quét mã</p>
          </div>
          <div>
            <div className="text-4xl mb-3">🌿</div>
            <h3 className="font-semibold mb-2">3. Xem nguồn gốc</h3>
            <p className="text-gray-600">Thông tin đầy đủ về lô trà của bạn</p>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-gray-400 text-sm">
        © 2026 Dojateas
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to `http://localhost:3000` — hero section and how-it-works grid render correctly.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add landing page"
```

---

## Task 7: Product query functions + admin product CRUD

**Files:**
- Create: `app/db/queries/products.ts`
- Create: `app/db/queries/products.test.ts`
- Create: `app/routes/admin.products.index.tsx`
- Create: `app/routes/admin.products.new.tsx`

- [ ] **Step 1: Write failing tests**

Create `app/db/queries/products.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '~/db'
import { products } from '~/db/schema'
import { getAllProducts, createProduct, getProductById } from './products'

beforeAll(async () => {
  await db.delete(products)
})

afterAll(async () => {
  await db.delete(products)
})

describe('product queries', () => {
  it('getAllProducts returns empty array initially', async () => {
    const result = await getAllProducts()
    expect(result).toEqual([])
  })

  it('createProduct inserts and returns the new product', async () => {
    const product = await createProduct({
      name: 'Trà Oolong Alishan',
      description: 'Trà từ núi Alishan',
      imageUrl: null,
    })
    expect(product.id).toBeDefined()
    expect(product.name).toBe('Trà Oolong Alishan')
  })

  it('getProductById returns correct product', async () => {
    const created = await createProduct({ name: 'Test', description: null, imageUrl: null })
    const found = await getProductById(created.id)
    expect(found?.id).toBe(created.id)
  })

  it('getProductById returns null for unknown id', async () => {
    const found = await getProductById('00000000-0000-0000-0000-000000000000')
    expect(found).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run app/db/queries/products.test.ts
```
Expected: FAIL — `getAllProducts` is not defined

- [ ] **Step 3: Create `app/db/queries/products.ts`**

```ts
import { db } from '~/db'
import { products } from '~/db/schema'
import { eq } from 'drizzle-orm'

export type NewProduct = {
  name: string
  description: string | null
  imageUrl: string | null
}

export async function getAllProducts() {
  return db.select().from(products).orderBy(products.createdAt)
}

export async function getProductById(id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id))
  return product ?? null
}

export async function createProduct(data: NewProduct) {
  const [product] = await db.insert(products).values(data).returning()
  return product
}

export async function updateProduct(id: string, data: Partial<NewProduct>) {
  const [product] = await db.update(products).set(data).where(eq(products.id, id)).returning()
  return product
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/db/queries/products.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Create `app/routes/admin.products.index.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/start'
import { getAllProducts } from '~/db/queries/products'

const fetchProducts = createServerFn({ method: 'GET' }).handler(() => getAllProducts())

export const Route = createFileRoute('/admin/products/')({
  loader: () => fetchProducts(),
  component: ProductsPage,
})

function ProductsPage() {
  const products = Route.useLoaderData()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sản phẩm</h1>
        <Link to="/admin/products/new" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
          + Thêm sản phẩm
        </Link>
      </div>
      {products.length === 0 && <p className="text-gray-500">Chưa có sản phẩm nào.</p>}
      <ul className="space-y-2">
        {products.map(p => (
          <li key={p.id} className="bg-white rounded shadow px-4 py-3 flex justify-between items-center">
            <span className="font-medium">{p.name}</span>
            {p.description && <span className="text-sm text-gray-500">{p.description}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 6: Create `app/routes/admin.products.new.tsx`**

```tsx
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/start'
import { useState } from 'react'
import { createProduct } from '~/db/queries/products'

const addProduct = createServerFn({ method: 'POST' })
  .validator((data: { name: string; description: string; imageUrl: string }) => data)
  .handler(({ data }) =>
    createProduct({
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
    })
  )

export const Route = createFileRoute('/admin/products/new')({
  component: NewProductPage,
})

function NewProductPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await addProduct({ data: { name, description, imageUrl } })
    router.navigate({ to: '/admin/products' })
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Thêm sản phẩm mới</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tên sản phẩm *</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mô tả</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">URL ảnh</label>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">Lưu</button>
          <button type="button" onClick={() => router.history.back()} className="px-4 py-2 rounded border hover:bg-gray-50">Huỷ</button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Manual verification**

1. Go to `/admin/products` → empty list with "+ Thêm sản phẩm"
2. Click → fill name "Trà Oolong Bảo Lộc" → submit → redirects to list, product appears

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: add product queries and admin product CRUD"
```

---

## Task 8: Batch query functions + admin batch CRUD

**Files:**
- Create: `app/db/queries/batches.ts`
- Create: `app/db/queries/batches.test.ts`
- Create: `app/routes/admin.batches.index.tsx`
- Create: `app/routes/admin.batches.new.tsx`
- Create: `app/routes/admin.batches.$id.tsx`

- [ ] **Step 1: Write failing tests**

Create `app/db/queries/batches.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '~/db'
import { products, batches, batchDetails } from '~/db/schema'
import { createBatch, getBatchWithDetails, getAllBatches, addBatchDetail, updateBatchStatus } from './batches'
import { createProduct } from './products'

let productId: string

beforeAll(async () => {
  await db.delete(batchDetails)
  await db.delete(batches)
  await db.delete(products)
  const product = await createProduct({ name: 'Test Trà', description: null, imageUrl: null })
  productId = product.id
})

afterAll(async () => {
  await db.delete(batchDetails)
  await db.delete(batches)
  await db.delete(products)
})

describe('batch queries', () => {
  it('createBatch inserts a new batch with status active', async () => {
    const batch = await createBatch({
      productId,
      harvestDate: '2026-04-01',
      productionDate: '2026-04-05',
      expiryDate: '2027-04-05',
      quantity: 100,
    })
    expect(batch.id).toBeDefined()
    expect(batch.status).toBe('active')
  })

  it('getAllBatches returns rows with productName joined', async () => {
    const rows = await getAllBatches()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].productName).toBe('Test Trà')
  })

  it('addBatchDetail inserts a detail row', async () => {
    const [batch] = await getAllBatches()
    const detail = await addBatchDetail({
      batchId: batch.id,
      key: 'origin_region',
      value: 'Bảo Lộc, Lâm Đồng',
      mediaUrl: null,
    })
    expect(detail.key).toBe('origin_region')
  })

  it('getBatchWithDetails returns batch with product and details', async () => {
    const [batch] = await getAllBatches()
    const result = await getBatchWithDetails(batch.id)
    expect(result).not.toBeNull()
    expect(result!.product.name).toBe('Test Trà')
    expect(result!.details.length).toBeGreaterThan(0)
  })

  it('updateBatchStatus changes status to recalled', async () => {
    const [batch] = await getAllBatches()
    const updated = await updateBatchStatus(batch.id, 'recalled')
    expect(updated.status).toBe('recalled')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run app/db/queries/batches.test.ts
```
Expected: FAIL — `createBatch` is not defined

- [ ] **Step 3: Create `app/db/queries/batches.ts`**

```ts
import { db } from '~/db'
import { batches, batchDetails, products } from '~/db/schema'
import { eq } from 'drizzle-orm'

export type NewBatch = {
  productId: string
  harvestDate: string
  productionDate: string
  expiryDate: string
  quantity: number
}

export type NewBatchDetail = {
  batchId: string
  key: string
  value: string
  mediaUrl: string | null
}

export async function getAllBatches() {
  return db
    .select({
      id: batches.id,
      productName: products.name,
      productId: batches.productId,
      harvestDate: batches.harvestDate,
      productionDate: batches.productionDate,
      expiryDate: batches.expiryDate,
      quantity: batches.quantity,
      status: batches.status,
      createdAt: batches.createdAt,
    })
    .from(batches)
    .innerJoin(products, eq(batches.productId, products.id))
    .orderBy(batches.createdAt)
}

export async function getBatchWithDetails(id: string) {
  const result = await db.query.batches.findFirst({
    where: eq(batches.id, id),
    with: { product: true, details: true },
  })
  return result ?? null
}

export async function createBatch(data: NewBatch) {
  const [batch] = await db.insert(batches).values(data).returning()
  return batch
}

export async function updateBatchStatus(id: string, status: 'active' | 'recalled') {
  const [batch] = await db.update(batches).set({ status }).where(eq(batches.id, id)).returning()
  return batch
}

export async function addBatchDetail(data: NewBatchDetail) {
  const [detail] = await db.insert(batchDetails).values(data).returning()
  return detail
}

export async function removeBatchDetail(id: string) {
  await db.delete(batchDetails).where(eq(batchDetails.id, id))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/db/queries/batches.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Create `app/routes/admin.batches.index.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/start'
import { getAllBatches } from '~/db/queries/batches'

const fetchBatches = createServerFn({ method: 'GET' }).handler(() => getAllBatches())

export const Route = createFileRoute('/admin/batches/')({
  loader: () => fetchBatches(),
  component: BatchesPage,
})

function BatchesPage() {
  const batches = Route.useLoaderData()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lô hàng</h1>
        <Link to="/admin/batches/new" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
          + Tạo lô mới
        </Link>
      </div>
      {batches.length === 0 && <p className="text-gray-500">Chưa có lô hàng nào.</p>}
      <ul className="space-y-2">
        {batches.map(b => (
          <li key={b.id} className="bg-white rounded shadow px-4 py-3 flex justify-between items-center">
            <div className="space-x-3">
              <span className="font-medium">{b.productName}</span>
              <span className="text-sm text-gray-500">Thu hái: {b.harvestDate}</span>
              {b.status === 'recalled' && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Thu hồi</span>
              )}
            </div>
            <div className="flex gap-3 text-sm">
              <Link to="/admin/batches/$id" params={{ id: b.id }} className="text-blue-600 hover:underline">Chi tiết</Link>
              <Link to="/admin/qr/$id" params={{ id: b.id }} className="text-green-700 hover:underline">QR</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 6: Create `app/routes/admin.batches.new.tsx`**

```tsx
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/start'
import { useState } from 'react'
import { getAllProducts } from '~/db/queries/products'
import { createBatch } from '~/db/queries/batches'

const fetchProducts = createServerFn({ method: 'GET' }).handler(() => getAllProducts())
const addBatch = createServerFn({ method: 'POST' })
  .validator((data: {
    productId: string
    harvestDate: string
    productionDate: string
    expiryDate: string
    quantity: number
  }) => data)
  .handler(({ data }) => createBatch(data))

export const Route = createFileRoute('/admin/batches/new')({
  loader: () => fetchProducts(),
  component: NewBatchPage,
})

function NewBatchPage() {
  const router = useRouter()
  const products = Route.useLoaderData()
  const [form, setForm] = useState({
    productId: '',
    harvestDate: '',
    productionDate: '',
    expiryDate: '',
    quantity: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await addBatch({ data: { ...form, quantity: Number(form.quantity) } })
    router.navigate({ to: '/admin/batches' })
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Tạo lô hàng mới</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Sản phẩm *</label>
          <select value={form.productId} onChange={e => set('productId', e.target.value)} required className="w-full border rounded px-3 py-2">
            <option value="">-- Chọn sản phẩm --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ngày thu hái *</label>
          <input type="date" value={form.harvestDate} onChange={e => set('harvestDate', e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ngày sản xuất *</label>
          <input type="date" value={form.productionDate} onChange={e => set('productionDate', e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hạn sử dụng *</label>
          <input type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Số lượng hộp *</label>
          <input type="number" min={1} value={form.quantity} onChange={e => set('quantity', e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">Tạo lô</button>
          <button type="button" onClick={() => router.history.back()} className="px-4 py-2 rounded border hover:bg-gray-50">Huỷ</button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Create `app/routes/admin.batches.$id.tsx`**

```tsx
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/start'
import { useState } from 'react'
import {
  getBatchWithDetails,
  addBatchDetail,
  removeBatchDetail,
  updateBatchStatus,
} from '~/db/queries/batches'

const fetchBatch = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(({ data: id }) => getBatchWithDetails(id))

const addDetail = createServerFn({ method: 'POST' })
  .validator((data: { batchId: string; key: string; value: string; mediaUrl: string | null }) => data)
  .handler(({ data }) => addBatchDetail(data))

const removeDetail = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(({ data: id }) => removeBatchDetail(id))

const setStatus = createServerFn({ method: 'POST' })
  .validator((data: { id: string; status: 'active' | 'recalled' }) => data)
  .handler(({ data }) => updateBatchStatus(data.id, data.status))

export const Route = createFileRoute('/admin/batches/$id')({
  loader: ({ params }) => fetchBatch({ data: params.id }),
  component: BatchDetailPage,
})

function BatchDetailPage() {
  const router = useRouter()
  const batch = Route.useLoaderData()
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')

  if (!batch) return <p className="text-gray-500">Không tìm thấy lô hàng.</p>

  async function handleAddDetail(e: React.FormEvent) {
    e.preventDefault()
    await addDetail({ data: { batchId: batch!.id, key, value, mediaUrl: mediaUrl || null } })
    setKey(''); setValue(''); setMediaUrl('')
    router.invalidate()
  }

  async function handleRemoveDetail(detailId: string) {
    await removeDetail({ data: detailId })
    router.invalidate()
  }

  async function handleToggleStatus() {
    const newStatus = batch!.status === 'active' ? 'recalled' : 'active'
    await setStatus({ data: { id: batch!.id, status: newStatus } })
    router.invalidate()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{batch.product.name}</h1>
        <button
          onClick={handleToggleStatus}
          className={`px-3 py-1 rounded text-sm ${batch.status === 'active' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
        >
          {batch.status === 'active' ? 'Đánh dấu thu hồi' : 'Khôi phục'}
        </button>
      </div>

      <div className="bg-white rounded shadow p-4 text-sm space-y-1">
        <p><span className="font-medium">Thu hái:</span> {batch.harvestDate}</p>
        <p><span className="font-medium">Sản xuất:</span> {batch.productionDate}</p>
        <p><span className="font-medium">Hạn sử dụng:</span> {batch.expiryDate}</p>
        <p><span className="font-medium">Số lượng:</span> {batch.quantity} hộp</p>
        <p>
          <span className="font-medium">Trạng thái:</span>{' '}
          <span className={batch.status === 'recalled' ? 'text-red-600' : 'text-green-700'}>{batch.status}</span>
        </p>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Chi tiết mở rộng</h2>
        {batch.details.length === 0 && <p className="text-gray-500 text-sm mb-3">Chưa có thông tin.</p>}
        <ul className="space-y-2 mb-4">
          {batch.details.map(d => (
            <li key={d.id} className="bg-white rounded shadow px-4 py-2 flex justify-between items-center text-sm">
              <span><span className="font-medium">{d.key}:</span> {d.value}</span>
              <button onClick={() => handleRemoveDetail(d.id)} className="text-red-500 hover:underline text-xs ml-4 flex-shrink-0">Xóa</button>
            </li>
          ))}
        </ul>

        <form onSubmit={handleAddDetail} className="bg-white rounded shadow p-4 space-y-3">
          <h3 className="font-medium text-sm">Thêm thông tin</h3>
          <input placeholder="Tên (vd: origin_region)" value={key} onChange={e => setKey(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm" />
          <input placeholder="Giá trị (vd: Bảo Lộc, Lâm Đồng)" value={value} onChange={e => setValue(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm" />
          <input placeholder="URL ảnh/video (tuỳ chọn)" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          <button type="submit" className="bg-green-700 text-white px-4 py-1.5 rounded text-sm hover:bg-green-800">Thêm</button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Manual verification**

1. `/admin/batches/new` → select product, fill all dates, submit → batch in list
2. Click "Chi tiết" → see info, add `origin_region` = "Bảo Lộc" → appears in list
3. Click "Xóa" on detail → disappears
4. Click "Đánh dấu thu hồi" → status turns red

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: add batch queries and admin batch CRUD with extended details"
```

---

## Task 9: QR code generation

**Files:**
- Create: `app/routes/api/qr.$batchId.ts`
- Create: `app/routes/admin.qr.$id.tsx`

- [ ] **Step 1: Create QR download API route `app/routes/api/qr.$batchId.ts`**

```ts
import { createAPIFileRoute } from '@tanstack/start/api'
import QRCode from 'qrcode'

export const APIRoute = createAPIFileRoute('/api/qr/$batchId')({
  GET: async ({ params }) => {
    const url = `${process.env.APP_URL}/trace/${params.batchId}`
    const buffer = await QRCode.toBuffer(url, { type: 'png', width: 400, margin: 2 })
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="qr-${params.batchId}.png"`,
      },
    })
  },
})
```

- [ ] **Step 2: Create `app/routes/admin.qr.$id.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/start'
import QRCode from 'qrcode'
import { getBatchWithDetails } from '~/db/queries/batches'

const fetchBatchQr = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const batch = await getBatchWithDetails(id)
    if (!batch) return null
    const traceUrl = `${process.env.APP_URL}/trace/${id}`
    const qrDataUrl = await QRCode.toDataURL(traceUrl, { width: 300, margin: 2 })
    return { batch, qrDataUrl, traceUrl }
  })

export const Route = createFileRoute('/admin/qr/$id')({
  loader: ({ params }) => fetchBatchQr({ data: params.id }),
  component: QRPage,
})

function QRPage() {
  const data = Route.useLoaderData()
  if (!data) return <p className="text-gray-500">Không tìm thấy lô hàng.</p>
  const { batch, qrDataUrl, traceUrl } = data

  return (
    <div className="max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">QR Code — {batch.product.name}</h1>
      <p className="text-sm text-gray-500">
        Thu hái: {batch.harvestDate} · {batch.quantity} hộp
      </p>

      <div className="bg-white rounded shadow p-6 flex flex-col items-center gap-4">
        <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
        <p className="text-xs text-gray-400 text-center break-all">{traceUrl}</p>
        <a
          href={`/api/qr/${batch.id}`}
          download={`qr-${batch.id}.png`}
          className="bg-green-700 text-white px-4 py-2 rounded w-full text-center hover:bg-green-800"
        >
          Tải xuống PNG
        </a>
      </div>

      <Link to="/admin/batches" className="text-sm text-blue-600 hover:underline">← Quay lại danh sách</Link>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

1. From batch list, click "QR" → QR image renders on page
2. Click "Tải xuống PNG" → browser downloads a PNG file named `qr-<uuid>.png`
3. Use a QR scanner on the downloaded PNG → URL opens to `/trace/<batchId>`

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add QR code generation and PNG download"
```

---

## Task 10: Public trace page

**Files:**
- Create: `app/components/RecallBanner.tsx`
- Create: `app/components/BatchDetailCard.tsx`
- Create: `app/routes/trace.$batchId.tsx`

- [ ] **Step 1: Create `app/components/RecallBanner.tsx`**

```tsx
export function RecallBanner() {
  return (
    <div className="bg-red-600 text-white px-4 py-3 rounded-lg text-center font-medium">
      ⚠️ Lô hàng này đã bị thu hồi. Vui lòng không sử dụng và liên hệ nơi mua để được hỗ trợ.
    </div>
  )
}
```

- [ ] **Step 2: Create `app/components/BatchDetailCard.tsx`**

```tsx
type Props = {
  label: string
  value: string
  mediaUrl?: string | null
}

export function BatchDetailCard({ label, value, mediaUrl }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
      {mediaUrl && (
        <img src={mediaUrl} alt={label} className="mt-2 rounded w-full max-h-48 object-cover" />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/routes/trace.$batchId.tsx`**

```tsx
import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/start'
import { getBatchWithDetails } from '~/db/queries/batches'
import { RecallBanner } from '~/components/RecallBanner'
import { BatchDetailCard } from '~/components/BatchDetailCard'

const fetchTrace = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(({ data: id }) => getBatchWithDetails(id))

const LABEL_MAP: Record<string, string> = {
  origin_region: 'Vùng trồng',
  altitude: 'Độ cao',
  farmer_name: 'Người thu hái',
  process: 'Quy trình chế biến',
}

export const Route = createFileRoute('/trace/$batchId')({
  loader: async ({ params }) => {
    const batch = await fetchTrace({ data: params.batchId })
    if (!batch) throw notFound()
    return batch
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-center p-6">
      <div>
        <p className="text-5xl mb-4">🍃</p>
        <h1 className="text-xl font-bold mb-2">Không tìm thấy lô hàng</h1>
        <p className="text-gray-500">Mã QR không hợp lệ hoặc lô hàng không tồn tại.</p>
      </div>
    </div>
  ),
  component: TracePage,
})

function TracePage() {
  const batch = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-900 text-white px-6 py-8">
        <p className="text-green-300 text-sm mb-2">Dojateas — Truy xuất nguồn gốc</p>
        {batch.product.imageUrl && (
          <img
            src={batch.product.imageUrl}
            alt={batch.product.name}
            className="w-20 h-20 object-cover rounded-lg mb-3"
          />
        )}
        <h1 className="text-2xl font-bold">{batch.product.name}</h1>
        {batch.product.description && (
          <p className="text-green-200 mt-1 text-sm">{batch.product.description}</p>
        )}
      </div>

      <div className="px-6 py-6 max-w-lg mx-auto space-y-4">
        {batch.status === 'recalled' && <RecallBanner />}

        <div className="bg-white rounded-lg shadow-sm border divide-y">
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-gray-500">Ngày thu hái</span>
            <span className="font-medium">{batch.harvestDate}</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-gray-500">Ngày sản xuất</span>
            <span className="font-medium">{batch.productionDate}</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-gray-500">Hạn sử dụng</span>
            <span className="font-medium">{batch.expiryDate}</span>
          </div>
        </div>

        {batch.details.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Thông tin thêm</h2>
            <div className="space-y-3">
              {batch.details.map(d => (
                <BatchDetailCard
                  key={d.id}
                  label={LABEL_MAP[d.key] ?? d.key}
                  value={d.value}
                  mediaUrl={d.mediaUrl}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pt-4">dojateas.vn</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Manual verification**

1. From admin, create a batch and add details (vùng trồng, độ cao, ảnh URL...)
2. Navigate to `/trace/<batchId>` → see product name, dates, detail cards
3. Navigate to `/trace/00000000-0000-0000-0000-000000000000` → shows "Không tìm thấy" page
4. Mark batch as recalled in admin → revisit trace URL → red banner appears

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add public trace page with recall banner and detail cards"
```

---

## Task 11: End-to-end smoke test

- [ ] **Step 1: Run all automated tests**

```bash
npx vitest run
```
Expected: All tests pass (products: 4, batches: 5)

- [ ] **Step 2: Full manual journey**

Run through in order:
1. `http://localhost:3000` → landing page renders with hero + how-it-works
2. `http://localhost:3000/admin` (logged out) → redirects to `/admin/login`
3. Log in with `admin@dojateas.vn` / `changeme123` → dashboard appears
4. `/admin/products/new` → create "Trà Oolong Bảo Lộc"
5. `/admin/batches/new` → select product, fill dates, quantity 200 → submit
6. `/admin/batches` → click "Chi tiết" → add `origin_region` = "Bảo Lộc, Lâm Đồng"
7. `/admin/batches` → click "QR" → QR renders, download PNG
8. Copy the trace URL shown under QR → open in new tab → all batch info shown
9. Back in admin, mark batch as "Thu hồi" → trace page shows red banner
10. Nav bar "Đăng xuất" → redirects to login

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete dojateas v1 — traceability system with QR, admin, and public trace page"
```
