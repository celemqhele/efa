import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <p className="text-7xl font-black text-accent mb-2">404</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
        <p className="text-slate-400 text-sm mb-8">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="px-6 py-2.5 bg-accent text-[#0a1128] font-bold rounded-lg hover:bg-[#e0c06a] transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}

