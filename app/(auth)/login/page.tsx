'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: form.password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setError('Login failed � email may need confirmation. Check Supabase Auth settings.')
      setLoading(false)
      return
    }

    // Hard navigation so the browser sends the fresh session cookies with the new request
    window.location.href = redirect
  }

  return (
    <Card className="p-6">
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
          <p className="text-feedback-error text-sm bg-feedback-error/10 border border-feedback-error/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button
          type="submit"
          isLoading={loading}
          className="w-full justify-center py-3"
        >
          Sign In
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted mt-4">
        No account?{' '}
        <Link href="/register" className="text-accent hover:text-accent-hover font-medium">
          Register
        </Link>
      </p>
    </Card>
  )
  }


export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-3">
            <span className="text-bg-base font-black text-xl">EFA</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Welcome back</h1>
          <p className="text-text-secondary text-sm mt-1">Efootball Federal Association</p>
        </div>

        <Suspense fallback={<Card className="p-6 text-text-secondary text-sm text-center">Loading…</Card>}>
          <LoginForm />
        </Suspense>

        <Link href="/" className="block text-center mt-4 text-xs text-text-secondary hover:text-text-primary transition-colors">
          Continue as guest
        </Link>
      </div>
    </div>
  )
}


