'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="text-5xl mb-4">??</div>
      <h2 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h2>
      <p className="text-text-muted text-sm mb-6">
        This page ran into an error. Try refreshing or go back home.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>
          Try again
        </Button>
        <Link
          href="/"
          className="px-5 py-2 border border-border text-foreground-secondary rounded-lg hover:border-accent/40 transition-colors text-sm"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}

