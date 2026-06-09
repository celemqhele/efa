'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="text-5xl mb-4">??</div>
      <h2 className="text-xl font-bold text-text-primary mb-2">Admin page error</h2>
      <p className="text-slate-400 text-sm mb-1">
        This admin page ran into an error.
      </p>
      {error.digest && (
        <p className="text-slate-600 text-xs mb-6 font-mono">ref: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <Button onClick={reset}>
          Try again
        </Button>
        <Link
          href="/admin/dashboard"
          className="px-5 py-2 border border-slate-200 text-slate-700 rounded-lg hover:border-accent/40 transition-colors text-sm"
        >
          Admin dashboard
        </Link>
      </div>
    </div>
  )
}

