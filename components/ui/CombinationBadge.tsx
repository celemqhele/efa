'use client'

import { useState } from 'react'
import { DNA_EXPLANATIONS } from '@/lib/dna-explanations'
import { LEVEL_LABELS, DNAProfile, DNACombination } from '@/lib/dna-engine'

interface Props {
  combination: DNACombination
  profiles: DNAProfile[]
  isOwnTeam: boolean
}

function perspectivize(text: string, isOwnTeam: boolean): string {
  if (isOwnTeam) return text
  return text
    .replace(/\bYour\b/g, 'Their')
    .replace(/\byour\b/g, 'their')
    .replace(/\bYou're\b/g, "They're")
    .replace(/\byou're\b/g, "they're")
    .replace(/\bYou've\b/g, "They've")
    .replace(/\byou've\b/g, "they've")
    .replace(/\bYou'll\b/g, "They'll")
    .replace(/\byou'll\b/g, "they'll")
    .replace(/\bYou\b/g, 'They')
    .replace(/\byou\b/g, 'they')
}

export default function CombinationBadge({ combination, profiles, isOwnTeam }: Props) {
  const [open, setOpen] = useState(false)
  const { name, level } = combination
  const levelInfo = LEVEL_LABELS[level] ?? { short: 'Match', detail: '' }

  const levelColor =
    level.startsWith('+++') ? 'text-green-500' :
    level.startsWith('++')  ? 'text-accent' :
    level === '+'           ? 'text-accent' :
                              'text-text-muted'

  // Merge content from all component profiles
  const allTendencies = profiles.flatMap((p) => {
    const exp = DNA_EXPLANATIONS[p.label]
    return exp ? exp.tendencies.map((t) => ({ text: t, profile: p })) : []
  })
  const allWeaknesses = profiles.flatMap((p) => {
    const exp = DNA_EXPLANATIONS[p.label]
    return exp ? exp.weaknesses.map((w) => ({ text: w, profile: p })) : []
  })
  const selfNotes = profiles
    .map((p) => ({ text: DNA_EXPLANATIONS[p.label]?.selfNote ?? '', profile: p }))
    .filter((n) => n.text)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent hover:opacity-80 active:scale-95 cursor-pointer transition-opacity"
      >
        <span>⚗️</span>
        <span>{name}</span>
        <span className={`font-mono ml-0.5 ${levelColor}`}>{level}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚗️</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground-primary font-bold text-base">{name}</h2>
                    <span className={`font-mono font-bold text-sm ${levelColor}`}>{level}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-accent">
                    Hybrid Playstyle
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-foreground-secondary text-xl leading-none shrink-0 mt-0.5"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-5 space-y-5">
              {/* Combined level */}
              <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl px-4 py-3">
                <span className={`font-mono font-bold text-lg ${levelColor}`}>{level}</span>
                <div>
                  <p className="text-foreground-primary text-sm font-semibold">{levelInfo.short}</p>
                  <p className="text-text-muted text-xs mt-0.5">{levelInfo.detail}</p>
                </div>
              </div>

              {/* Component profiles */}
              <div>
                <h3 className="text-foreground-primary font-semibold text-xs uppercase tracking-wider mb-2">
                  Built From
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {profiles.map((p) => (
                    <span
                      key={p.label}
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${p.color}`}
                    >
                      <span>{p.emoji}</span>
                      <span>{p.label}</span>
                      <span className={`font-mono font-bold ml-0.5 ${
                        p.level.startsWith('+++') ? 'text-green-500' :
                        p.level.startsWith('++')  ? 'text-accent' :
                        p.level === '+'           ? 'text-accent' :
                                                    'text-text-muted'
                      }`}>{p.level}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* About */}
              <p className="text-foreground-muted text-sm leading-relaxed">
                {isOwnTeam
                  ? `Your game doesn't fit a single mould — it's a compound identity. The ${name} style emerges from the combination of ${profiles.map((p) => p.label).join(' and ')}, making your approach genuinely difficult to prepare for.`
                  : `This team doesn't fit a single mould. The ${name} style is a compound identity — a combination of ${profiles.map((p) => p.label).join(' and ')} that makes them genuinely unpredictable.`
                }
              </p>

              {isOwnTeam ? (
                <>
                  {/* Tendencies */}
                  <div>
                    <h3 className="text-foreground-primary font-semibold text-xs uppercase tracking-wider mb-2">
                      Combined Tendencies
                    </h3>
                    <ul className="space-y-1.5">
                      {allTendencies.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                          <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${t.profile.color}`}>
                            {t.profile.emoji}
                          </span>
                          {t.text}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Coach notes */}
                  {selfNotes.map((n, i) => (
                    <div key={i} className="bg-accent/10 border border-accent/30 rounded-xl p-4">
                      <h3 className="text-accent font-semibold text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${n.profile.color}`}>{n.profile.emoji}</span>
                        Coach Note — {n.profile.label}
                      </h3>
                      <p className="text-foreground-secondary text-sm leading-relaxed">{n.text}</p>
                    </div>
                  ))}

                  {/* Vulnerabilities */}
                  <div>
                    <h3 className="text-foreground-primary font-semibold text-xs uppercase tracking-wider mb-2">
                      Vulnerabilities to Watch
                    </h3>
                    <ul className="space-y-1.5">
                      {allWeaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                          <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
                          {w.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  {/* What to expect */}
                  <div>
                    <h3 className="text-foreground-primary font-semibold text-xs uppercase tracking-wider mb-2">
                      What to Expect
                    </h3>
                    <ul className="space-y-1.5">
                      {allTendencies.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                          <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${t.profile.color}`}>
                            {t.profile.emoji}
                          </span>
                          {t.text}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Exploit weaknesses */}
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <h3 className="text-red-400 font-semibold text-xs uppercase tracking-wider mb-2">
                      How to Exploit Their Weaknesses
                    </h3>
                    <ul className="space-y-1.5">
                      {allWeaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                          <span className="text-red-400 shrink-0 mt-0.5">⚡</span>
                          {perspectivize(w.text, false)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border shrink-0">
              <button onClick={() => setOpen(false)} className="w-full btn-outline text-sm py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

