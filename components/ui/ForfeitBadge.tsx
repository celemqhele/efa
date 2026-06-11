'use client'

import { useState, useRef, useEffect } from 'react'

interface ForfeitBadgeProps {
  note?: string | null
}

export default function ForfeitBadge({ note }: ForfeitBadgeProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!note) return null

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[10px] font-bold text-orange-400 hover:bg-orange-500/30 transition-colors"
        title="Forfeit"
      >
        F
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-bg-elevated border border-border shadow-lg text-xs text-text-primary z-50 whitespace-pre-line">
          {note}
        </div>
      )}
    </div>
  )
}
