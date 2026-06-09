import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getAllProducts } from '#/db/queries/products'

const fetchProducts = createServerFn({ method: 'GET' }).handler(() => getAllProducts())

export const Route = createFileRoute('/admin/products/')({
  loader: () => fetchProducts(),
  component: ProductsPage,
})

function ProductsPage() {
  const products = Route.useLoaderData()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sản phẩm</h1>
        <Link to="/admin/products/new" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
          + Thêm sản phẩm
        </Link>
      </div>
      {products.length === 0 && <p className="text-gray-500">Chưa có sản phẩm nào.</p>}
      <ul className="space-y-2">
        {products.map(p => (
          <li key={p.id} className="bg-white rounded shadow px-4 py-3 flex justify-between items-center">
            <span className="font-medium">{p.name}</span>
            {p.description && <span className="text-sm text-gray-500">{p.description}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
