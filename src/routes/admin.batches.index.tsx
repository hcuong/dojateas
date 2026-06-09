import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getAllBatches } from '#/db/queries/batches'

const fetchBatches = createServerFn({ method: 'GET' }).handler(() => getAllBatches())

export const Route = createFileRoute('/admin/batches/')({
  loader: () => fetchBatches(),
  component: BatchesPage,
})

function BatchesPage() {
  const batches = Route.useLoaderData()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lô hàng</h1>
        <Link to="/admin/batches/new" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
          + Tạo lô mới
        </Link>
      </div>
      {batches.length === 0 && <p className="text-gray-500">Chưa có lô hàng nào.</p>}
      <ul className="space-y-2">
        {batches.map(b => (
          <li key={b.id} className="bg-white rounded shadow px-4 py-3 flex justify-between items-center">
            <div className="space-x-3">
              <span className="font-medium">{b.productName}</span>
              <span className="text-sm text-gray-500">Thu hái: {b.harvestDate}</span>
              {b.status === 'recalled' && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Thu hồi</span>
              )}
            </div>
            <div className="flex gap-3 text-sm">
              <Link to="/admin/batches/$id" params={{ id: b.id }} className="text-blue-600 hover:underline">Chi tiết</Link>
              <Link to={"/admin/qr/$id" as any} params={{ id: b.id } as any} className="text-green-700 hover:underline">QR</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
