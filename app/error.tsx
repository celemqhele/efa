'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-slate-50 text-slate-100 min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">??</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-400 text-sm mb-6">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-accent text-[#0a1128] font-bold rounded-lg hover:bg-[#e0c06a] transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

