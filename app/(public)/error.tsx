'use client'

import Link from 'next/link'

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
      <p className="text-slate-400 text-sm mb-6">
        This page ran into an error. Try refreshing or go back home.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2 bg-[#c9a84c] text-[#0a1128] font-bold rounded-lg hover:bg-[#e0c06a] transition-colors text-sm"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-5 py-2 border border-slate-200 text-slate-700 rounded-lg hover:border-[#c9a84c]/40 transition-colors text-sm"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
