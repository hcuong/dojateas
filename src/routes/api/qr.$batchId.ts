import { createFileRoute } from '@tanstack/react-router'
import QRCode from 'qrcode'

export const Route = createFileRoute('/api/qr/$batchId')({
  preload: false,
  server: {
    handlers: {
      GET: async ({ params }: { params: { batchId: string } }) => {
        const baseUrl = process.env.APP_URL ?? 'http://localhost:3000'
        const url = `${baseUrl}/trace/${params.batchId}`
        const svg = await QRCode.toString(url, { type: 'svg', width: 400, margin: 2 })
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
