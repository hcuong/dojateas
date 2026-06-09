import { createFileRoute, Outlet, redirect, Link, useRouter } from '@tanstack/react-router'
import { getAdminSession } from '#/lib/auth'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getAdminSession()
    if (!session) throw redirect({ to: '/admin/login' })
    return { session }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.navigate({ to: '/admin/login' })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-green-800 text-white px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">Dojateas Admin</span>
        <div className="flex gap-4 items-center text-sm">
          <Link to="/admin/products" className="hover:underline">Sản phẩm</Link>
          <Link to={"/admin/batches" as any} className="hover:underline">Lô hàng</Link>
          <button onClick={handleSignOut} className="opacity-75 hover:opacity-100">Đăng xuất</button>
        </div>
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
