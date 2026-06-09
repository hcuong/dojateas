import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getBatchWithDetails } from '#/db/queries/batches'
import { RecallBanner } from '#/components/RecallBanner'
import { BatchDetailCard } from '#/components/BatchDetailCard'

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
