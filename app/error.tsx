'use client'

import { Button } from '@/components/ui/Button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-bg-base text-text-primary min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Something went wrong</h1>
          <p className="text-text-muted text-sm mb-6">
            An unexpected error occurred. Please try again.
          </p>
          <Button
            onClick={reset}
          >
            Try again
          </Button>
        </div>
      </body>
    </html>
  )
}

