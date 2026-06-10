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
