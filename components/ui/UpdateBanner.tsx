'use client'

import { useEffect, useRef, useState } from 'react'

let globalBuildId: string | null = null
let listeners: Set<(id: string) => void> = new Set()

async function pollVersion() {
  try {
    const res = await fetch('/api/version')
    if (!res.ok) return
    const { buildId } = await res.json()
    if (!globalBuildId) {
      globalBuildId = buildId
    } else if (globalBuildId !== buildId) {
      listeners.forEach((fn) => fn(buildId))
    }
  } catch {}
}

// Poll every 60s
if (typeof window !== 'undefined') {
  setInterval(pollVersion, 60000)
  // Also check on page visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pollVersion()
  })
  // Initial check after 5s (give SW time to activate)
  setTimeout(pollVersion, 5000)
}

export default function UpdateBanner() {
  const [stale, setStale] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const shownRef = useRef(false)

  useEffect(() => {
    const handler = () => {
      if (!shownRef.current) {
        shownRef.current = true
        setStale(true)
      }
    }
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])

  if (!stale || dismissed) return null

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] sm:w-auto">
      <div className="bg-gold text-navy rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 border border-gold/60">
        <p className="text-xs font-semibold whitespace-nowrap">
          A new version is available
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="bg-navy text-gold text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-navy/90 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-navy/60 hover:text-navy text-xs font-medium transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
