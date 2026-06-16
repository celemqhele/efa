'use client'

import { DISCONNECT_RULES, OFFICIAL_RULES } from '@/lib/disconnect-rules'
import { Check, X, Home, Clock, UserMinus, ShieldBan, CalendarX, ChevronRight } from 'lucide-react'

export default function Desktop() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">EFA Rule Book</h1>
        <p className="text-sm text-text-muted mt-1">
          Official match rules, disconnect protocols, and platform guidelines.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <section className="bg-bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
              <h2 className="text-base font-bold text-text-primary">EFA Official Match Rules</h2>
            </div>

            <ul className="space-y-2">
              {OFFICIAL_RULES.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-bg-elevated/50 border border-border/50 hover:border-accent/30 transition-colors"
                >
                  <span className="text-base leading-none mt-0.5 shrink-0">
                    {item.icon === 'check' ? <Check className="w-4 h-4 text-feedback-success" /> : item.icon === 'cross' ? <X className="w-4 h-4 text-feedback-error" /> : <Home className="w-4 h-4 text-accent" />}
                  </span>
                  <span className="text-sm text-text-secondary leading-snug">{item.rule}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <span className="w-1 h-5 rounded-full bg-feedback-error shrink-0" />
              <h2 className="text-base font-bold text-text-primary">Abandonment Rules</h2>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 p-4 rounded-xl bg-bg-elevated/50 border border-border/50">
                <Clock className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">Reporting Window</p>
                  <p className="text-sm text-text-muted leading-relaxed">
                    The <span className="text-accent font-medium">Report Waiting</span> button is
                    available from <span className="text-text-primary font-medium">13:00 to 14:05 SAST</span>.
                    Only use it if your opponent has not shown up for the scheduled fixture.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex gap-3 p-3.5 rounded-xl bg-feedback-success/5 border border-feedback-success/15 hover:bg-feedback-success/10 transition-colors">
                  <UserMinus className="w-5 h-5 text-feedback-success shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary leading-snug">
                    If the <span className="text-feedback-success font-semibold">home team</span> submits a
                    waiting report and the away team does not respond, the{' '}
                    <span className="text-feedback-success font-semibold">away team receives an auto-loss</span>.
                  </p>
                </div>

                <div className="flex gap-3 p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/15 hover:bg-blue-500/10 transition-colors">
                  <UserMinus className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary leading-snug">
                    If the <span className="text-blue-400 font-semibold">away team</span> submits a
                    waiting report and the home team does not respond, the{' '}
                    <span className="text-blue-400 font-semibold">home team receives an auto-loss</span>.
                  </p>
                </div>

                <div className="flex gap-3 p-3.5 rounded-xl bg-bg-elevated/50 border border-border/50 hover:bg-bg-elevated transition-colors">
                  <ShieldBan className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary leading-snug">
                    If <span className="text-text-primary font-semibold">neither team</span> submits a
                    waiting report, the fixture is recorded as a{' '}
                    <span className="text-text-primary font-semibold">0-0 draw with no points</span> awarded
                    to either side.
                  </p>
                </div>

                <div className="flex gap-3 p-3.5 rounded-xl bg-feedback-error/5 border border-feedback-error/15 hover:bg-feedback-error/10 transition-colors">
                  <ShieldBan className="w-5 h-5 text-feedback-error shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary leading-snug">
                    Any team with{' '}
                    <span className="text-feedback-error font-semibold">3 or more abandonments</span> will be
                    flagged for <span className="text-feedback-error font-semibold">admin review</span> and may
                    face disciplinary action.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
              <h2 className="text-base font-bold text-text-primary">Matchroom Instructions</h2>
            </div>

            <div className="flex gap-4 p-5 rounded-xl bg-gradient-to-r from-accent/10 to-transparent border border-accent/25">
              <Home className="w-8 h-8 text-accent shrink-0 self-start" />
              <div className="space-y-2">
                <p className="text-text-primary font-semibold text-base">
                  The Home Team Always Creates the Matchroom
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  In eFootball, it is the responsibility of the{' '}
                  <span className="text-accent font-semibold">home team</span> — as listed in the
                  fixture — to open and host the matchroom. The away team joins the room created by the
                  home team.
                </p>
                <p className="text-sm text-text-muted leading-relaxed">
                  Make sure you check the fixture card to confirm which team is home before
                  your scheduled kick-off time. Failure to create the matchroom as the home team may
                  result in a waiting report being filed against you.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Before every match
              </p>
              {[
                'Check the fixture card to confirm you are home or away.',
                'If you are the HOME team, create the matchroom in eFootball.',
                'If you are the AWAY team, search for and join the home team\'s matchroom.',
                'Confirm the correct match settings are applied (see rules above).',
                'Submit the result screenshot on the platform after the match.',
              ].map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-bg-elevated/50 border border-border/50 hover:bg-bg-elevated transition-colors"
                >
                  <span className="shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-text-secondary leading-snug">{step}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <span className="w-1 h-5 rounded-full bg-yellow-500 shrink-0" />
              <h2 className="text-base font-bold text-text-primary">Disconnect Rules</h2>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              If a disconnect occurs during a match, the restart duration is determined by the minute
              the disconnect happened. Aggregate score from the abandoned segment is always carried
              forward.
            </p>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-base">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-accent uppercase tracking-wider">
                      Disconnect At
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-accent uppercase tracking-wider">
                      Restart Duration
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-accent uppercase tracking-wider">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DISCONNECT_RULES.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border/60 hover:bg-accent/5 transition-colors ${
                        i % 2 === 0 ? '' : 'bg-bg-surface/40'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-accent font-semibold text-sm whitespace-nowrap">
                        {row.minute}
                      </td>
                      <td className="px-4 py-3 text-text-primary text-sm">{row.restart}</td>
                      <td className="px-4 py-3 text-text-muted text-sm">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <span className="w-1 h-5 rounded-full bg-orange-500 shrink-0" />
              <h2 className="text-base font-bold text-text-primary">Anti-Forfeit Rule</h2>
            </div>
            <div className="flex gap-4 p-4 rounded-xl bg-orange-500/5 border border-orange-500/15 hover:bg-orange-500/10 transition-colors">
              <ShieldBan className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  If a manager forfeits a match (fails to show, abandons, or concedes), the score from
                  that fixture <span className="text-orange-400 font-semibold">carries over</span> to
                  the next match between the same two teams. The forfeiting team also receives a{' '}
                  <span className="text-orange-400 font-semibold">-3 goal difference (GD) penalty</span>{' '}
                  applied at the end of the season.
                </p>
                <p className="text-sm text-text-muted leading-relaxed mt-2">
                  This ensures that forfeiting is never an advantageous strategy and that the
                  aggrieved team still gets competitive fixture time.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <span className="w-1 h-5 rounded-full bg-rose-500 shrink-0" />
              <h2 className="text-base font-bold text-text-primary">No-Postponements Policy</h2>
            </div>
            <div className="flex gap-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/15 hover:bg-rose-500/10 transition-colors">
              <CalendarX className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Matches will <span className="text-rose-400 font-semibold">not</span> be postponed
                  under normal circumstances. If a manager cannot play their fixture at the scheduled
                  time, a <span className="text-rose-400 font-semibold">backdoor loss</span> will be
                  awarded — unless the manager has messaged an admin{' '}
                  <span className="text-rose-400 font-semibold">before the deadline</span> with a
                  valid reason.
                </p>
                <p className="text-sm text-text-muted leading-relaxed mt-2">
                  Valid reasons are reviewed on a case-by-case basis by the administration.
                  Last-minute or no-show situations without prior notice will result in an
                  automatic loss.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <p className="text-center text-xs text-text-muted pb-4">
        Rules last updated by EFA administration. All decisions by admins are final.
      </p>
    </div>
  )
}
