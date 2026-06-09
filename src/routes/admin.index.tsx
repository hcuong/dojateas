import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

function AdminDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <Link to={"/admin/products" as any} className="block p-6 bg-white rounded shadow hover:shadow-md text-center font-medium">
          Sản phẩm
        </Link>
        <Link to={"/admin/batches" as any} className="block p-6 bg-white rounded shadow hover:shadow-md text-center font-medium">
          Lô hàng
        </Link>
      </div>
    </div>
  )
}
