import { createFileRoute } from '@tanstack/react-router'
import QRCode from 'qrcode'

export const Route = createFileRoute('/api/qr/$batchId')({
  preload: false,
  server: {
    handlers: {
      GET: async ({ params }: { params: { batchId: string } }) => {
        const url = `${process.env.APP_URL}/trace/${params.batchId}`
        const buffer = await QRCode.toBuffer(url, { type: 'png', width: 400, margin: 2 })
        return new Response(new Uint8Array(buffer), {
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="qr-${params.batchId}.png"`,
          },
        })
      },
    },
  },
})
