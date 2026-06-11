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
