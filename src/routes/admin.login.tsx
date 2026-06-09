import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/admin/login')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error: signInError } = await authClient.signIn.email({ email, password })
    if (signInError) {
      setError('Email hoặc mật khẩu không đúng')
      return
    }
    router.navigate({ to: '/admin' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Dojateas Admin</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <button type="submit" className="w-full bg-green-700 text-white py-2 rounded hover:bg-green-800">
          Đăng nhập
        </button>
      </form>
    </div>
  )
}
