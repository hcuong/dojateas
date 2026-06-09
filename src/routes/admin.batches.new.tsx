import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getAllProducts } from '#/db/queries/products'
import { createBatch } from '#/db/queries/batches'
import { getAdminSession } from '#/lib/auth.functions'

const fetchProducts = createServerFn({ method: 'GET' }).handler(() => getAllProducts())
const addBatch = createServerFn({ method: 'POST' })
  .validator((data: {
    productId: string
    harvestDate: string
    productionDate: string
    expiryDate: string
    quantity: number
  }) => data)
  .handler(async ({ data }) => {
    const session = await getAdminSession()
    if (!session) throw new Error('Unauthorized')
    return createBatch(data)
  })

export const Route = createFileRoute('/admin/batches/new')({
  loader: () => fetchProducts(),
  component: NewBatchPage,
})

function NewBatchPage() {
  const router = useRouter()
  const products = Route.useLoaderData()
  const [form, setForm] = useState({
    productId: '',
    harvestDate: '',
    productionDate: '',
    expiryDate: '',
    quantity: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await addBatch({ data: { ...form, quantity: Number(form.quantity) } })
    router.navigate({ to: '/admin/batches' })
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Tạo lô hàng mới</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Sản phẩm *</label>
          <select value={form.productId} onChange={e => set('productId', e.target.value)} required className="w-full border rounded px-3 py-2">
            <option value="">-- Chọn sản phẩm --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ngày thu hái *</label>
          <input type="date" value={form.harvestDate} onChange={e => set('harvestDate', e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ngày sản xuất *</label>
          <input type="date" value={form.productionDate} onChange={e => set('productionDate', e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hạn sử dụng *</label>
          <input type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Số lượng hộp *</label>
          <input type="number" min={1} value={form.quantity} onChange={e => set('quantity', e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">Tạo lô</button>
          <button type="button" onClick={() => router.history.back()} className="px-4 py-2 rounded border hover:bg-gray-50">Huỷ</button>
        </div>
      </form>
    </div>
  )
}
