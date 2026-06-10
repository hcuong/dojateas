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
