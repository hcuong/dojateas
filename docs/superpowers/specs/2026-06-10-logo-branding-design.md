# Logo Branding: QR Code Embedding + Favicon/Manifest

**Date:** 2026-06-10
**Source asset:** `public/doja_logo.png` (830×835, dark-green squircle `#475A47` with cream `#F5F2E9` leaf mark)

---

## Overview

A new logo (`public/doja_logo.png`) was added but isn't used anywhere yet. This spec covers two scoped, low-risk uses of it:

1. Embed the logo into the center of generated QR codes (the artifact printed on product packaging for traceability).
2. Replace the leftover TanStack Start template favicon/PWA icons and `manifest.json` with versions based on the new logo.

Out of scope (deferred to a future spec): header/nav logo placement on the landing page, admin panel, and trace page; any broader site color rebrand.

---

## Part 1: QR Code Logo Embedding

### Approach

Pure SVG string post-processing of the output from the `qrcode` package — no new dependencies, no canvas. This matters because the project deploys to Cloudflare Workers (no canvas/DOM available), which is why QR generation was recently switched from canvas to SVG (`9a3e9b9`).

### Logo asset embedding

Import the logo as a base64 data URI at build time, so the generated SVG is fully self-contained (no runtime fetch, works identically in dev and on Workers):

```ts
import logoDataUri from '../assets/doja-logo-qr.png?inline'
```

Vite's `?inline` query forces the asset to be inlined as a base64 data URI regardless of `assetsInlineLimit` (confirmed via `inlineRE` in the installed Vite version's asset plugin) — but **only for files outside `public/`**. Files in `public/` skip Vite's asset pipeline entirely; in production builds `?inline` on a public-dir file falls back to the default 4KB `assetsInlineLimit` and would not be inlined. So a small resized copy of the logo (~120px, optimized for the QR overlay size) lives at `src/assets/doja-logo-qr.png`, separate from `public/doja_logo.png`.

### Shared helper — `src/lib/qr.ts`

```ts
import QRCode from 'qrcode'
import logoDataUri from '../assets/doja-logo-qr.png?inline'

const LOGO_RATIO = 0.2 // logo width as a fraction of the QR code's viewBox size

export async function generateQrSvgWithLogo(url: string, width: number): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'H', // 30% recovery — required headroom for the logo overlay
    width,
    margin: 2,
  })

  // qrcode's SVG viewBox is in QR module units (e.g. "0 0 33 33"), not pixels —
  // the logo must be sized/positioned in that coordinate system.
  const match = svg.match(/viewBox="0 0 (\d+) \d+"/)
  const qrSize = match ? Number(match[1]) : width

  const logoSize = qrSize * LOGO_RATIO
  const offset = (qrSize - logoSize) / 2

  const logoTag = `<image href="${logoDataUri}" x="${offset}" y="${offset}" width="${logoSize}" height="${logoSize}"/>`

  return svg.replace('</svg>', `${logoTag}</svg>`)
}
```

Notes:
- `errorCorrectionLevel: 'H'` (current code doesn't set one, defaulting to `'M'` ~15%) gives 30% damage tolerance, comfortably covering a 20%-width (≈4% area) logo overlay placed directly on top of existing modules — no need to "excavate" pixels first.
- Direct overlay, per your earlier choice: the logo's own dark-green squircle background sits as-is on the QR pattern, no extra white padding/backing rect.

### Call sites updated to use the helper

- `src/routes/api/qr.$batchId.ts` — downloadable SVG (currently `width: 400`)
- `src/routes/admin.qr.$id.tsx` — in-browser preview (currently `width: 300`), so the preview matches the download

Both currently call `QRCode.toString(url, { type: 'svg', width, margin: 2 })` directly with no error-correction level set; both calls are replaced with `generateQrSvgWithLogo(url, width)`.

### Testing

- Unit test for `generateQrSvgWithLogo` (pure async function): given a URL and width, assert the returned string contains an `<image href="data:image/png;base64,...">` tag, and that `errorCorrectionLevel: 'H'` produces a larger viewBox than the default level for the same input (sanity check that EC level is actually applied).
- Manual: generate a QR via `/api/qr/<existing-batch-id>`, scan with a phone camera to confirm it still resolves to the correct `/trace/<batchId>` URL with the logo overlay in place.

---

## Part 2: Favicon / Manifest Branding

### Generated assets (from `public/doja_logo.png`, via ImageMagick)

| File | Size | Purpose |
|---|---|---|
| `public/favicon.ico` | multi-res 16/32/48 | browser tab icon (replaces TanStack default) |
| `public/logo192.png` | 192×192 | PWA manifest icon (replaces TanStack default) |
| `public/logo512.png` | 512×512 | PWA manifest icon (replaces TanStack default) |
| `public/apple-touch-icon.png` | 180×180 | new — iOS home-screen icon |

```bash
magick public/doja_logo.png -resize 512x512! public/logo512.png
magick public/doja_logo.png -resize 192x192! public/logo192.png
magick public/doja_logo.png -resize 180x180! public/apple-touch-icon.png
magick public/doja_logo.png -define icon:auto-resize=48,32,16 public/favicon.ico
```

(Exact background/flattening treatment for the smaller sizes will be checked visually during implementation — the source PNG has some transparency/anti-aliasing around the squircle edge.)

### `public/manifest.json`

Replace the TanStack placeholder content:

```json
{
  "short_name": "Dojateas",
  "name": "Dojateas",
  "icons": [
    { "src": "favicon.ico", "sizes": "64x64 32x32 24x24 16x16", "type": "image/x-icon" },
    { "src": "logo192.png", "type": "image/png", "sizes": "192x192" },
    { "src": "logo512.png", "type": "image/png", "sizes": "512x512" }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#475A47",
  "background_color": "#F5F2E9"
}
```

`theme_color`/`background_color` are sampled from the logo (`#475A47` dark green, `#F5F2E9` cream).

### `src/routes/__root.tsx`

`manifest.json` currently exists in `public/` but isn't linked from the document head at all — fixed as part of this change. Add to the `links` array (alongside the existing stylesheet link):

```ts
links: [
  { rel: 'stylesheet', href: appCss },
  { rel: 'icon', href: '/favicon.ico' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  { rel: 'manifest', href: '/manifest.json' },
],
```

And add to `meta`:

```ts
{ name: 'theme-color', content: '#475A47' },
```

### Testing

None — pure asset generation + metadata wiring, no logic or layout changes. Verified visually (favicon in browser tab, manifest in devtools Application panel).

---

## What Is Not Changing

- Landing page, admin nav, trace page layouts/headers — no logo placed in the UI yet (deferred)
- No site-wide color changes — `green-900`/`green-800` Tailwind classes used in headers stay as-is
- `qrcode` package and SVG-based generation strategy — unchanged, just routed through the new helper
