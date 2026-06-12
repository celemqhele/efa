'use client'

import { useState } from 'react'
import { DNA_EXPLANATIONS } from '@/lib/dna-explanations'
import { LEVEL_LABELS } from '@/lib/dna-engine'
import {
  Crown, Drama, Zap, Brain, Sword, Shield, Dumbbell,
  ArrowLeftRight, Triangle, Crosshair, Scale,
} from 'lucide-react'

const DNA_ICONS: Record<string, React.ReactNode> = {
  crown: <Crown className="w-4 h-4" />,
  theater: <Drama className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
  brain: <Brain className="w-4 h-4" />,
  dagger: <Sword className="w-4 h-4" />,
  shield: <Shield className="w-4 h-4" />,
  muscle: <Dumbbell className="w-4 h-4" />,
  arrows_horizontal: <ArrowLeftRight className="w-4 h-4" />,
  triangle: <Triangle className="w-4 h-4" />,
  target: <Crosshair className="w-4 h-4" />,
  scale: <Scale className="w-4 h-4" />,
}

const DNA_ICONS_LARGE: Record<string, React.ReactNode> = {
  crown: <Crown className="w-7 h-7" />,
  theater: <Drama className="w-7 h-7" />,
  zap: <Zap className="w-7 h-7" />,
  brain: <Brain className="w-7 h-7" />,
  dagger: <Sword className="w-7 h-7" />,
  shield: <Shield className="w-7 h-7" />,
  muscle: <Dumbbell className="w-7 h-7" />,
  arrows_horizontal: <ArrowLeftRight className="w-7 h-7" />,
  triangle: <Triangle className="w-7 h-7" />,
  target: <Crosshair className="w-7 h-7" />,
  scale: <Scale className="w-7 h-7" />,
}

function getIcon(iconName: string): React.ReactNode {
  return DNA_ICONS[iconName] ?? <span>{iconName}</span>
}

function getIconLarge(iconName: string): React.ReactNode {
  return DNA_ICONS_LARGE[iconName] ?? <span>{iconName}</span>
}

interface Props {
  label: string
  iconName: string
  color: string
  level: string
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

export default function DNABadge({ label, iconName, color, level, isOwnTeam }: Props) {
  const [open, setOpen] = useState(false)
  const explanation = DNA_EXPLANATIONS[label]
  const levelInfo = LEVEL_LABELS[level] ?? { short: 'Match', detail: '' }

  const levelColor =
    level.startsWith('+++') ? 'text-green-500' :
    level.startsWith('++')  ? 'text-accent' :
    level === '+'           ? 'text-accent' :
                              'text-text-muted'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80 active:scale-95 cursor-pointer ${color}`}
      >
        {getIcon(iconName)}
        <span>{label}</span>
        <span className={`font-mono font-bold ml-0.5 ${levelColor}`}>{level}</span>
      </button>

      {open && explanation && (
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
                {getIconLarge(iconName)}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground-primary font-bold text-base">{label}</h2>
                    <span className={`font-mono font-bold text-sm ${levelColor}`}>{level}</span>
                  </div>
                  <span className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
                    {isOwnTeam ? 'Your Team\'s Style' : 'Opponent\'s Style'}
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
              {/* Style match level */}
              <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl px-4 py-3">
                <span className={`font-mono font-bold text-lg ${levelColor}`}>{level}</span>
                <div>
                  <p className="text-foreground-primary text-sm font-semibold">{levelInfo.short}</p>
                  <p className="text-text-muted text-xs mt-0.5">{levelInfo.detail}</p>
                </div>
              </div>

              {/* About */}
              <p className="text-foreground-muted text-sm leading-relaxed">{explanation.about}</p>

              {isOwnTeam ? (
                <>
                  <div>
                    <h3 className="text-foreground-primary font-semibold text-xs uppercase tracking-wider mb-2">
                      Your Tendencies
                    </h3>
                    <ul className="space-y-1.5">
                      {explanation.tendencies.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                          <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
                    <h3 className="text-accent font-semibold text-xs uppercase tracking-wider mb-1.5">
                      Coach Note
                    </h3>
                    <p className="text-foreground-secondary text-sm leading-relaxed">{explanation.selfNote}</p>
                  </div>

                  <div>
                    <h3 className="text-foreground-primary font-semibold text-xs uppercase tracking-wider mb-2">
                      Vulnerabilities to Watch
                    </h3>
                    <ul className="space-y-1.5">
                      {explanation.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                          <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-foreground-primary font-semibold text-xs uppercase tracking-wider mb-2">
                      What to Expect
                    </h3>
                    <ul className="space-y-1.5">
                      {explanation.tendencies.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                          <span className="text-blue-400 shrink-0 mt-0.5">›</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <h3 className="text-red-400 font-semibold text-xs uppercase tracking-wider mb-2">
                      How to Exploit Their Weaknesses
                    </h3>
                    <ul className="space-y-1.5">
                      {explanation.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                          <span className="text-red-400 shrink-0 mt-0.5">⚡</span>
                          {perspectivize(w, false)}
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

