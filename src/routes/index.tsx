import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen">
      <section className="bg-green-900 text-white py-24 px-6 text-center">
        <h1 className="text-5xl font-bold mb-4">Dojateas</h1>
        <p className="text-xl text-green-200 mb-6">Trà sạch — Nguồn gốc minh bạch</p>
        <p className="text-green-300 max-w-lg mx-auto">
          Mỗi hộp trà đều mang một câu chuyện. Quét QR code để biết trà của bạn đến từ đâu,
          được thu hái ngày nào, và qua những công đoạn gì.
        </p>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-10">Cách hoạt động</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl mb-3">📦</div>
            <h3 className="font-semibold mb-2">1. Mua hộp trà</h3>
            <p className="text-gray-600">Tìm mã QR trên hộp sản phẩm</p>
          </div>
          <div>
            <div className="text-4xl mb-3">📱</div>
            <h3 className="font-semibold mb-2">2. Quét QR</h3>
            <p className="text-gray-600">Dùng camera điện thoại quét mã</p>
          </div>
          <div>
            <div className="text-4xl mb-3">🌿</div>
            <h3 className="font-semibold mb-2">3. Xem nguồn gốc</h3>
            <p className="text-gray-600">Thông tin đầy đủ về lô trà của bạn</p>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-gray-400 text-sm">
        © 2026 Dojateas
      </footer>
    </div>
  )
}
