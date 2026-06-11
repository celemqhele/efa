'use client'

import { useState } from 'react'
import type { TeamState } from '@/lib/team-states'

interface Props {
  states: TeamState[]
}

export default function TeamStateBadges({ states }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (!states.length) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {states.map((s) => (
        <div key={s.id} className="relative">
          <button
            onClick={() => setOpenId(openId === s.id ? null : s.id)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer transition-opacity hover:opacity-80 ${s.color}`}
          >
            {s.label}
          </button>
          {openId === s.id && (
            <div className="absolute z-50 top-full mt-1 left-0 w-56 bg-bg-surface border border-border rounded-lg shadow-lg p-3 text-xs">
              <p className="text-text-primary leading-relaxed">{s.description}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
