import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { createProduct } from '#/db/queries/products'
import { getAdminSession } from '#/lib/auth'

const addProduct = createServerFn({ method: 'POST' })
  .validator((data: { name: string; description: string; imageUrl: string }) => data)
  .handler(async ({ data }) => {
    const session = await getAdminSession()
    if (!session) throw new Error('Unauthorized')
    return createProduct({
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
    })
  })

export const Route = createFileRoute('/admin/products/new')({
  component: NewProductPage,
})

function NewProductPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await addProduct({ data: { name, description, imageUrl } })
    router.navigate({ to: '/admin/products' })
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Thêm sản phẩm mới</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tên sản phẩm *</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mô tả</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">URL ảnh</label>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">Lưu</button>
          <button type="button" onClick={() => router.history.back()} className="px-4 py-2 rounded border hover:bg-gray-50">Huỷ</button>
        </div>
      </form>
    </div>
  )
}
