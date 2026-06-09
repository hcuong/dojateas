import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import QRCode from 'qrcode'
import { getBatchWithDetails } from '#/db/queries/batches'

const fetchBatchQr = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const batch = await getBatchWithDetails(id)
    if (!batch) return null
    const baseUrl = process.env.APP_URL ?? 'http://localhost:3000'
    const traceUrl = `${baseUrl}/trace/${id}`
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
