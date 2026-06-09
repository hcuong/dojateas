import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  getBatchWithDetails,
  addBatchDetail,
  removeBatchDetail,
  updateBatchStatus,
} from '#/db/queries/batches'
import { getAdminSession } from '#/lib/auth.functions'

const fetchBatch = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(({ data: id }) => getBatchWithDetails(id))

const addDetail = createServerFn({ method: 'POST' })
  .validator((data: { batchId: string; key: string; value: string; mediaUrl: string | null }) => data)
  .handler(async ({ data }) => {
    const session = await getAdminSession()
    if (!session) throw new Error('Unauthorized')
    return addBatchDetail(data)
  })

const removeDetail = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const session = await getAdminSession()
    if (!session) throw new Error('Unauthorized')
    return removeBatchDetail(id)
  })

const setStatus = createServerFn({ method: 'POST' })
  .validator((data: { id: string; status: 'active' | 'recalled' }) => data)
  .handler(async ({ data }) => {
    const session = await getAdminSession()
    if (!session) throw new Error('Unauthorized')
    return updateBatchStatus(data.id, data.status)
  })

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
