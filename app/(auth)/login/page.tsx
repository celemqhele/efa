'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'
  const supabase = createClient()

  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const email = `${form.username.toLowerCase().trim()}@efa.local`

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: form.password,
    })

    if (authError) {
      setError('Invalid username or password.')
      setLoading(false)
      return
    }

    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="card p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Username</label>
          <input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            className="input-field"
            placeholder="your_username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="form-label">Password</label>
          <input
            type="password"
            className="input-field"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-gold w-full justify-center py-3 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-4">
        No account?{' '}
        <Link href="/register" className="text-[#c9a84c] hover:text-[#e0c06a] font-medium">
          Register
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0a1128] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#a07830] flex items-center justify-center mb-3">
            <span className="text-[#0a1128] font-black text-xl">EFA</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Efootball Federal Association</p>
        </div>

        <Suspense fallback={<div className="card p-6 text-slate-400 text-sm text-center">Loading…</div>}>
          <LoginForm />
        </Suspense>

        <Link href="/" className="block text-center mt-4 text-xs text-slate-600 hover:text-slate-400 transition-colors">
          Continue as guest
        </Link>
      </div>
    </div>
  )
}
