'use client'

import { useState, useEffect } from 'react'
import { LEVEL_LABELS, type PersonalizedDescription, type MatchupCoachNote } from '@/lib/dna-engine'
import {
  Crown, Drama, Zap, Brain, Swords, Shield, Dumbbell,
  ArrowLeftRight, Triangle, Crosshair, Scale, Eye, AlertTriangle, Target, Settings,
} from 'lucide-react'
import { Button } from './Button'

const DNA_ICONS: Record<string, React.ReactNode> = {
  crown: <Crown className="w-4 h-4" />,
  theater: <Drama className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
  brain: <Brain className="w-4 h-4" />,
  dagger: <Swords className="w-4 h-4" />,
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
  dagger: <Swords className="w-7 h-7" />,
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
  personalized?: PersonalizedDescription | null
  viewerTeamId?: string
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

export default function DNABadge({ label, iconName, color, level, isOwnTeam, personalized, viewerTeamId }: Props) {
  const [open, setOpen] = useState(false)
  const levelInfo = LEVEL_LABELS[level] ?? { short: 'Match', detail: '' }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

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

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            className="relative bg-bg-surface border border-border rounded-lg p-6 w-full max-w-md shadow-md animate-in fade-in zoom-in-95 duration-fast max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 shrink-0">
              {getIconLarge(iconName)}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-text-primary font-bold text-lg truncate">{label}</h2>
                  <span className={`font-mono font-bold text-sm shrink-0 ${levelColor}`}>{level}</span>
                </div>
                <span className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
                  {isOwnTeam ? 'Your Team\'s Style' : 'Opponent\'s Style'}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto space-y-4">
              {personalized ? (
                <>
                  <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl px-4 py-3">
                    <span className={`font-mono font-bold text-lg ${levelColor}`}>{level}</span>
                    <div>
                      <p className="text-text-primary text-sm font-semibold">{levelInfo.short}</p>
                      <p className="text-text-muted text-xs mt-0.5">{levelInfo.detail}</p>
                    </div>
                  </div>

                  <p className="text-text-secondary text-sm leading-relaxed">{personalized.about}</p>

                  {isOwnTeam ? (
                    <>
                      <div>
                        <h3 className="text-text-primary font-semibold text-xs uppercase tracking-wider mb-2">Your Tendencies</h3>
                        <ul className="space-y-1.5">
                          {personalized.tendencies.map((t, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                              <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
                        <h3 className="text-accent font-semibold text-xs uppercase tracking-wider mb-1.5">Coach Note</h3>
                        <p className="text-text-secondary text-sm leading-relaxed">{personalized.coachNote}</p>
                      </div>

                      <div>
                        <h3 className="text-text-primary font-semibold text-xs uppercase tracking-wider mb-2">Vulnerabilities to Watch</h3>
                        <ul className="space-y-1.5">
                          {personalized.weaknesses.map((w, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
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
                        <h3 className="text-text-primary font-semibold text-xs uppercase tracking-wider mb-2">What to Expect</h3>
                        <ul className="space-y-1.5">
                          {personalized.tendencies.map((t, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                              <span className="text-blue-400 shrink-0 mt-0.5">›</span>
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                        <h3 className="text-red-400 font-semibold text-xs uppercase tracking-wider mb-2">How to Exploit Their Weaknesses</h3>
                        <ul className="space-y-1.5">
                          {personalized.weaknesses.map((w, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                              <span className="text-red-400 shrink-0 mt-0.5">⚡</span>
                              {perspectivize(w, false)}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {viewerTeamId && personalized.matchupCoachNotes?.[viewerTeamId] && (() => {
                        const note: MatchupCoachNote = personalized.matchupCoachNotes![viewerTeamId]
                        return (
                          <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
                            <h3 className="text-accent font-semibold text-xs uppercase tracking-wider mb-3">Matchup Coach Notes</h3>
                            <div className="space-y-3">
                              <div className="flex items-start gap-2">
                                <Target className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-semibold text-text-primary uppercase tracking-wide">Approach</p>
                                  <p className="text-sm text-text-secondary leading-relaxed">{note.approach}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-semibold text-text-primary uppercase tracking-wide">Key Threat</p>
                                  <p className="text-sm text-text-secondary leading-relaxed">{note.key_threat}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <Eye className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-semibold text-text-primary uppercase tracking-wide">Exploit</p>
                                  <p className="text-sm text-text-secondary leading-relaxed">{note.exploit}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <Settings className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-semibold text-text-primary uppercase tracking-wide">Set Up</p>
                                  <p className="text-sm text-text-secondary leading-relaxed">{note.setup}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  )}
                </>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-text-muted text-sm">Playstyle analysis for this team has not been completed yet.</p>
                  <p className="text-text-muted text-xs mt-1">The AI assistant will review match data and provide a personalized breakdown soon.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-space-2 mt-4 pt-4 border-t border-border shrink-0">
              <Button variant="primary" onClick={() => setOpen(false)}>Okay</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
