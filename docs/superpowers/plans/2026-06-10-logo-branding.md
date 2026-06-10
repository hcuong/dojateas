# Logo Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed the new Dojateas logo into the center of generated QR codes, and replace the leftover TanStack Start template favicon/PWA icons and manifest with versions based on the new logo.

**Architecture:** A shared `generateQrSvgWithLogo()` helper in `src/lib/qr.ts` generates a QR code SVG (via the existing `qrcode` package, error-correction level `'H'`) and post-processes the SVG string to inject a base64-embedded `<image>` tag in the center. The logo is embedded via Vite's `?inline` import from a small resized copy under `src/assets/` (NOT `public/`, since Vite's `?inline` does not force-inline files served from the public directory in production builds — only `src/`-relative imports get that guarantee in both dev and build). Both QR call sites (`/api/qr/$batchId` download route and the admin QR preview) switch to this helper. Separately, `public/doja_logo.png` is resized with ImageMagick into `favicon.ico`, `logo192.png`, `logo512.png`, and a new `apple-touch-icon.png`, and `manifest.json` / `__root.tsx` are updated to reference them with Dojateas branding (name, theme color `#475A47`, background color `#F5F2E9`).

**Tech Stack:** TanStack Start, `qrcode` (SVG renderer), Vite asset pipeline (`?inline`), Vitest, ImageMagick (`magick` CLI, available locally).

**Spec:** `docs/superpowers/specs/2026-06-10-logo-branding-design.md`

---

## Task 1: Add resized logo asset for QR embedding

**Files:**
- Create: `src/assets/doja-logo-qr.png`
- Create: `src/vite-env.d.ts`

The full-size `public/doja_logo.png` is 830×835 / 28KB — too large to embed in every QR code. A 120px copy is plenty for the ~20%-of-QR-width logo overlay and keeps the embedded base64 small (~8KB PNG → ~11KB base64).

`src/assets/doja-logo-qr.png` must live outside `public/` because Vite's `?inline` query only guarantees base64-inlining (regardless of file size) for files resolved through the normal asset pipeline. Files under `public/` skip that pipeline and fall back to the default `assetsInlineLimit` (4KB) in production builds, so `?inline` would silently stop working at build time for a public-dir file.

- [ ] **Step 1: Generate the resized logo**

```bash
mkdir -p src/assets
magick public/doja_logo.png -resize 120x120 src/assets/doja-logo-qr.png
```

Verify it was created:

```bash
file src/assets/doja-logo-qr.png
```

Expected: `PNG image data, 119 x 120, 8-bit/color RGBA, non-interlaced`

- [ ] **Step 2: Add a type declaration for `*.png?inline` imports**

`vite/client.d.ts` (already in `tsconfig.json`'s `types`) declares `*.png` but not the `?inline` query suffix, so TypeScript won't resolve `import logo from './doja-logo-qr.png?inline'` without this.

Create `src/vite-env.d.ts`:

```ts
declare module '*.png?inline' {
  const src: string
  export default src
}
```

- [ ] **Step 3: Commit**

```bash
git add src/assets/doja-logo-qr.png src/vite-env.d.ts
git commit -m "feat: add resized logo asset for QR embedding"
```

---

## Task 2: Implement `generateQrSvgWithLogo` helper (TDD)

**Files:**
- Create: `src/lib/qr.ts`
- Test: `src/lib/qr.test.ts`

`qrcode`'s SVG renderer outputs `viewBox="0 0 N N"` where `N` is in QR *module* units (not pixels) — `N = moduleCount + margin*2`. The injected `<image>` must be sized/positioned in that same coordinate system.

- [ ] **Step 1: Write the failing test**

Create `src/lib/qr.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import QRCode from 'qrcode'
import { generateQrSvgWithLogo } from './qr'

const TRACE_URL = 'http://localhost:3000/trace/abcdef12-3456-7890-abcd-ef1234567890'

describe('generateQrSvgWithLogo', () => {
  it('embeds the logo as a centered base64 image', async () => {
    const svg = await generateQrSvgWithLogo(TRACE_URL, 400)

    // This URL needs 49 modules (incl. margin) at error-correction level H
    expect(svg).toMatch(/viewBox="0 0 49 49"/)

    const match = svg.match(
      /<image href="(data:image\/png;base64,[^"]+)" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/
    )
    expect(match).not.toBeNull()

    const [, , x, y, width, height] = match!
    expect(width).toBe('9.8')
    expect(height).toBe('9.8')
    expect(x).toBe('19.6')
    expect(y).toBe('19.6')
  })

  it('uses error-correction level H, producing a larger QR than the default level', async () => {
    const withLogo = await generateQrSvgWithLogo(TRACE_URL, 400)
    const defaultSvg = await QRCode.toString(TRACE_URL, { type: 'svg', width: 400, margin: 2 })

    const withLogoSize = Number(withLogo.match(/viewBox="0 0 (\d+) \d+"/)![1])
    const defaultSize = Number(defaultSvg.match(/viewBox="0 0 (\d+) \d+"/)![1])

    expect(withLogoSize).toBeGreaterThan(defaultSize)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/qr.test.ts`
Expected: FAIL — `Cannot find module './qr'` (or similar resolution error), since `src/lib/qr.ts` doesn't exist yet.

- [ ] **Step 3: Implement the helper**

Create `src/lib/qr.ts`:

```ts
import QRCode from 'qrcode'
import logoDataUri from '../assets/doja-logo-qr.png?inline'

const LOGO_RATIO = 0.2

export async function generateQrSvgWithLogo(url: string, width: number): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    width,
    margin: 2,
  })

  // qrcode's viewBox is "0 0 N N" in QR module units, not pixels
  const match = svg.match(/viewBox="0 0 (\d+) \d+"/)
  const qrSize = match ? Number(match[1]) : width

  const logoSize = qrSize * LOGO_RATIO
  const offset = (qrSize - logoSize) / 2

  const logoTag = `<image href="${logoDataUri}" x="${offset}" y="${offset}" width="${logoSize}" height="${logoSize}"/>`

  return svg.replace('</svg>', `${logoTag}</svg>`)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/qr.test.ts`
Expected: PASS — 2 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/qr.ts src/lib/qr.test.ts
git commit -m "feat: add generateQrSvgWithLogo helper with logo overlay"
```

---

## Task 3: Embed logo in the downloadable QR code

**Files:**
- Modify: `src/routes/api/qr.$batchId.ts`

- [ ] **Step 1: Replace the QR generation call**

In `src/routes/api/qr.$batchId.ts`, replace line 2:

```ts
import QRCode from 'qrcode'
```

with:

```ts
import { generateQrSvgWithLogo } from '#/lib/qr'
```

And replace line 11:

```ts
        const svg = await QRCode.toString(url, { type: 'svg', width: 400, margin: 2 })
```

with:

```ts
        const svg = await generateQrSvgWithLogo(url, 400)
```

The full file should now read:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { generateQrSvgWithLogo } from '#/lib/qr'

export const Route = createFileRoute('/api/qr/$batchId')({
  preload: false,
  server: {
    handlers: {
      GET: async ({ params }: { params: { batchId: string } }) => {
        const baseUrl = process.env.APP_URL ?? 'http://localhost:3000'
        const url = `${baseUrl}/trace/${params.batchId}`
        const svg = await generateQrSvgWithLogo(url, 400)
        return new Response(svg, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Content-Disposition': `attachment; filename="qr-${params.batchId}.svg"`,
          },
        })
      },
    },
  },
})
```

- [ ] **Step 2: Verify with the dev server**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/api/qr/sample-batch | grep -o '<image href="data:image/png;base64,[^"]\{0,30\}'
kill %1
```

Expected: prints `<image href="data:image/png;base64,iVBORw0KGgo...` (a PNG base64 header), confirming the logo is embedded in the response SVG.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/qr.\$batchId.ts
git commit -m "feat: embed logo in downloadable QR code"
```

---

## Task 4: Embed logo in admin QR preview

**Files:**
- Modify: `src/routes/admin.qr.$id.tsx`

- [ ] **Step 1: Replace the QR generation call**

In `src/routes/admin.qr.$id.tsx`, replace line 3:

```ts
import QRCode from 'qrcode'
```

with:

```ts
import { generateQrSvgWithLogo } from '#/lib/qr'
```

And replace line 13:

```ts
    const svg = await QRCode.toString(traceUrl, { type: 'svg', width: 300, margin: 2 })
```

with:

```ts
    const svg = await generateQrSvgWithLogo(traceUrl, 300)
```

The top of the file (lines 1–16) should now read:

```ts
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { generateQrSvgWithLogo } from '#/lib/qr'
import { getBatchWithDetails } from '#/db/queries/batches'

const fetchBatchQr = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const batch = await getBatchWithDetails(id)
    if (!batch) return null
    const baseUrl = process.env.APP_URL ?? 'http://localhost:3000'
    const traceUrl = `${baseUrl}/trace/${id}`
    const svg = await generateQrSvgWithLogo(traceUrl, 300)
    const qrDataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`
    return { batch, qrDataUrl, traceUrl }
  })
```

The rest of the file (the `QRPage` component) is unchanged.

- [ ] **Step 2: Commit**

```bash
git add src/routes/admin.qr.\$id.tsx
git commit -m "feat: embed logo in admin QR preview"
```

---

## Task 5: Generate favicon and PWA icons from the new logo

**Files:**
- Modify (binary): `public/favicon.ico`
- Modify (binary): `public/logo192.png`
- Modify (binary): `public/logo512.png`
- Create (binary): `public/apple-touch-icon.png`

These commands were dry-run tested and produce valid output (verified sizes: `logo512.png` 512×512, `logo192.png` 192×192, `apple-touch-icon.png` 180×180 RGB, `favicon.ico` multi-resolution 16/32/48).

- [ ] **Step 1: Generate the icons**

```bash
magick public/doja_logo.png -resize 512x512! public/logo512.png
magick public/doja_logo.png -resize 192x192! public/logo192.png
magick public/doja_logo.png -resize 180x180! -background white -alpha remove -alpha off public/apple-touch-icon.png
magick public/doja_logo.png -define icon:auto-resize=48,32,16 public/favicon.ico
```

`apple-touch-icon.png` is flattened onto a white background (no alpha) since iOS renders home-screen icons opaque and applies its own corner rounding/mask.

- [ ] **Step 2: Verify**

```bash
file public/favicon.ico public/logo192.png public/logo512.png public/apple-touch-icon.png
```

Expected:
```
public/favicon.ico:        MS Windows icon resource - 3 icons, 48x48, 32 bits/pixel, 32x32, 32 bits/pixel, ...
public/logo192.png:        PNG image data, 192 x 192, 8-bit/color RGBA, non-interlaced
public/logo512.png:        PNG image data, 512 x 512, 8-bit/color RGBA, non-interlaced
public/apple-touch-icon.png: PNG image data, 180 x 180, 8-bit/color RGB, non-interlaced
```

- [ ] **Step 3: Commit**

```bash
git add public/favicon.ico public/logo192.png public/logo512.png public/apple-touch-icon.png
git commit -m "feat: replace placeholder favicon and PWA icons with Dojateas logo"
```

---

## Task 6: Update PWA manifest with Dojateas branding

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: Replace the manifest content**

Replace the entire contents of `public/manifest.json` with:

```json
{
  "short_name": "Dojateas",
  "name": "Dojateas",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    },
    {
      "src": "logo192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "logo512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#475A47",
  "background_color": "#F5F2E9"
}
```

- [ ] **Step 2: Commit**

```bash
git add public/manifest.json
git commit -m "feat: update PWA manifest with Dojateas branding"
```

---

## Task 7: Link favicon, manifest, and theme color in the root document

**Files:**
- Modify: `src/routes/__root.tsx`

`manifest.json` currently exists in `public/` but isn't referenced anywhere in the document head — this task fixes that along with adding the favicon/apple-touch-icon links and theme-color meta tag.

- [ ] **Step 1: Update the root route's `head()`**

Replace the `head: () => ({ ... })` block in `src/routes/__root.tsx` (lines 6–25) with:

```ts
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#475A47',
      },
      {
        title: 'Dojateas — Trà sạch từ nguồn',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),
```

The full file should now read:

```ts
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#475A47',
      },
      {
        title: 'Dojateas — Trà sạch từ nguồn',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: link favicon, manifest, and theme color in root document head"
```

---

## Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests pass, including the new `src/lib/qr.test.ts` (2 tests).

- [ ] **Step 2: Run a production build**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors — this confirms the `?inline` logo import resolves correctly in `vite build` (not just dev), and that `manifest.json`/icon files are picked up from `public/`.

- [ ] **Step 3: Manually verify the QR code in a browser**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/api/qr/sample-batch -o /tmp/qr-sample.svg
open /tmp/qr-sample.svg
```

Expected: opens in the browser showing a QR code with the Dojateas leaf logo centered on top. Optionally scan it with a phone camera — it should resolve to `http://localhost:3000/trace/sample-batch` despite the logo overlay.

- [ ] **Step 4: Manually verify favicon and manifest**

```bash
curl -sI http://localhost:3000/favicon.ico | head -1
curl -s http://localhost:3000/manifest.json
kill %1
```

Expected: `favicon.ico` returns `200 OK`, and `manifest.json` shows `"name": "Dojateas"`, `"theme_color": "#475A47"`, `"background_color": "#F5F2E9"`. Open `http://localhost:3000` in a browser and confirm the new leaf icon appears as the tab favicon.
