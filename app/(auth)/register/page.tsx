'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    if (form.username.length < 3) {
      setError('Username must be at least 3 characters.')
      setLoading(false)
      return
    }

    const username = form.username.toLowerCase().trim()
    const email = `${username}@efa.local`

    // Check username uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) {
      setError('Username is already taken.')
      setLoading(false)
      return
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        data: { username },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/select-team')
  }

  return (
    <div className="min-h-screen bg-[#0a1128] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#a07830] flex items-center justify-center mb-3">
            <span className="text-[#0a1128] font-black text-xl">EFA</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-slate-400 text-sm mt-1">Join the EFA</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Username</label>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                className="input-field"
                placeholder="choose_a_username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, '_') })}
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                title="Letters, numbers, and underscores only"
              />
              <p className="text-xs text-slate-600 mt-1">Letters, numbers, underscores only</p>
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
                minLength={8}
              />
            </div>

            <div>
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
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
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-[#c9a84c] hover:text-[#e0c06a] font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
