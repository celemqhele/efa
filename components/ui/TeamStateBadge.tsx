'use client'

import { useState, useEffect } from 'react'
import type { TeamState } from '@/lib/team-states'
import { Button } from './Button'

interface Props {
  states: TeamState[]
}

export default function TeamStateBadges({ states }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!openId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openId])

  if (!states.length) return null

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {states.map((s) => (
          <button
            key={s.id}
            onClick={() => setOpenId(s.id)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer transition-opacity hover:opacity-80 active:scale-95 ${s.color}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {states.map((s) => {
        if (openId !== s.id) return null
        return (
          <div key={s.id} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpenId(null)} />
            <div
              className="relative bg-bg-surface border border-border rounded-lg p-6 w-full max-w-md shadow-md animate-in fade-in zoom-in-95 duration-fast"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${s.color}`}>{s.label}</span>
              </div>
              <div className="overflow-y-auto">
                <p className="text-text-secondary text-sm leading-relaxed">{s.description}</p>
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t border-border">
                <Button variant="primary" onClick={() => setOpenId(null)}>Okay</Button>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
