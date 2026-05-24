'use client'

import { useState } from 'react'
import { DNA_EXPLANATIONS } from '@/lib/dna-explanations'

interface Props {
  label: string
  emoji: string
  color: string
  isOwnTeam: boolean
}

export default function DNABadge({ label, emoji, color, isOwnTeam }: Props) {
  const [open, setOpen] = useState(false)
  const explanation = DNA_EXPLANATIONS[label]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80 active:scale-95 cursor-pointer ${color}`}
      >
        {emoji} {label}
      </button>

      {open && explanation && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-slate-50 border border-slate-200 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{emoji}</span>
                <div>
                  <h2 className="text-slate-900 font-bold text-base">{label}</h2>
                  <span className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
                    {isOwnTeam ? 'Your Team\'s Style' : 'Opponent\'s Style'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none shrink-0 mt-0.5"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-5 space-y-5">
              {/* About */}
              <p className="text-slate-600 text-sm leading-relaxed">{explanation.about}</p>

              {isOwnTeam ? (
                <>
                  {/* Self view: tendencies */}
                  <div>
                    <h3 className="text-slate-900 font-semibold text-xs uppercase tracking-wider mb-2">
                      Your Tendencies
                    </h3>
                    <ul className="space-y-1.5">
                      {explanation.tendencies.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Self view: personal note */}
                  <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-xl p-4">
                    <h3 className="text-[#c9a84c] font-semibold text-xs uppercase tracking-wider mb-1.5">
                      Coach Note
                    </h3>
                    <p className="text-slate-700 text-sm leading-relaxed">{explanation.selfNote}</p>
                  </div>

                  {/* Self view: weaknesses */}
                  <div>
                    <h3 className="text-slate-900 font-semibold text-xs uppercase tracking-wider mb-2">
                      Vulnerabilities to Watch
                    </h3>
                    <ul className="space-y-1.5">
                      {explanation.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  {/* Opponent view: what to expect */}
                  <div>
                    <h3 className="text-slate-900 font-semibold text-xs uppercase tracking-wider mb-2">
                      What to Expect
                    </h3>
                    <ul className="space-y-1.5">
                      {explanation.tendencies.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-blue-400 shrink-0 mt-0.5">›</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Opponent view: how to exploit */}
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <h3 className="text-red-400 font-semibold text-xs uppercase tracking-wider mb-2">
                      How to Exploit Their Weaknesses
                    </h3>
                    <ul className="space-y-1.5">
                      {explanation.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-red-400 shrink-0 mt-0.5">⚡</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="w-full btn-outline text-sm py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
