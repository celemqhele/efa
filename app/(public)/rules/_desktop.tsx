'use client'

import { DISCONNECT_RULES, OFFICIAL_RULES } from '@/lib/disconnect-rules'
import { Check, X, Home, Clock, UserMinus, ShieldBan, CalendarX } from 'lucide-react'

export default function Desktop() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground-primary">EFA Rule Book</h1>
        <p className="text-sm text-text-muted mt-1">
          Official match rules, disconnect protocols, and platform guidelines.
        </p>
      </div>

      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-accent" />
          <h2 className="text-lg font-bold text-foreground-primary">EFA Official Match Rules</h2>
        </div>

        <ul className="space-y-2">
          {OFFICIAL_RULES.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-bg-surface border border-border hover:border-accent/30 transition-colors"
            >
              <span className="text-base leading-none mt-0.5 flex-shrink-0">{item.icon === 'check' ? <Check className="w-4 h-4 text-green-400" /> : item.icon === 'cross' ? <X className="w-4 h-4 text-red-400" /> : <Home className="w-4 h-4 text-accent" />}</span>
              <span className="text-sm text-slate-200 leading-snug">{item.rule}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-yellow-500" />
          <h2 className="text-lg font-bold text-foreground-primary">Disconnect Rules</h2>
        </div>
        <p className="text-sm text-text-muted leading-relaxed">
          If a disconnect occurs during a match, the restart duration is determined by the minute
          the disconnect happened. Aggregate score from the abandoned segment is always carried
          forward.
        </p>

        <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-surface border-b border-border">
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
                  className={`border-b border-border/60 hover:bg-black/[0.03] transition-colors ${
                    i % 2 === 0 ? '' : 'bg-bg-surface/40'
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-accent font-semibold text-sm whitespace-nowrap">
                    {row.minute}
                  </td>
                  <td className="px-4 py-3 text-foreground-primary text-sm">{row.restart}</td>
                  <td className="px-4 py-3 text-text-muted text-sm">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block sm:hidden space-y-2">
          {DISCONNECT_RULES.map((row, i) => (
            <div key={i} className="rounded-lg border border-border bg-bg-surface p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted uppercase tracking-wider">At</span>
                <span className="font-mono text-accent font-semibold text-sm">{row.minute}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted uppercase tracking-wider">Restart</span>
                <span className="text-foreground-primary text-sm">{row.restart}</span>
              </div>
              {row.note && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-text-muted uppercase tracking-wider shrink-0">Note</span>
                  <span className="text-text-muted text-sm">{row.note}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-red-500" />
          <h2 className="text-lg font-bold text-foreground-primary">Abandonment Rules</h2>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3 p-4 rounded-lg bg-bg-surface border border-border">
            <Clock className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground-primary mb-1">Reporting Window</p>
              <p className="text-sm text-text-muted leading-relaxed">
                The <span className="text-accent font-medium">Report Waiting</span> button is
                available from <span className="text-foreground-primary font-medium">13:00 to 14:05 SAST</span>.
                Only use it if your opponent has not shown up for the scheduled fixture.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-3 p-3.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <UserMinus className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200 leading-snug">
                If the <span className="text-green-400 font-semibold">home team</span> submits a
                waiting report and the away team does not respond, the{' '}
                <span className="text-green-400 font-semibold">away team receives an auto-loss</span>.
              </p>
            </div>

            <div className="flex gap-3 p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <UserMinus className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200 leading-snug">
                If the <span className="text-blue-400 font-semibold">away team</span> submits a
                waiting report and the home team does not respond, the{' '}
                <span className="text-blue-400 font-semibold">home team receives an auto-loss</span>.
              </p>
            </div>

            <div className="flex gap-3 p-3.5 rounded-lg bg-bg-surface0/10 border border-slate-500/20">
              <ShieldBan className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200 leading-snug">
                If <span className="text-foreground-secondary font-semibold">neither team</span> submits a
                waiting report, the fixture is recorded as a{' '}
                <span className="text-foreground-secondary font-semibold">0–0 draw with no points</span> awarded
                to either side.
              </p>
            </div>

            <div className="flex gap-3 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <ShieldBan className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200 leading-snug">
                Any team with{' '}
                <span className="text-red-400 font-semibold">3 or more abandonments</span> will be
                flagged for <span className="text-red-400 font-semibold">admin review</span> and may
                face disciplinary action.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-orange-500" />
          <h2 className="text-lg font-bold text-foreground-primary">Anti-Forfeit Rule</h2>
        </div>
        <div className="flex gap-3 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <ShieldBan className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-slate-200 leading-relaxed">
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

      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-rose-500" />
          <h2 className="text-lg font-bold text-foreground-primary">No-Postponements Policy</h2>
        </div>
        <div className="flex gap-3 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <CalendarX className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-slate-200 leading-relaxed">
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

      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-accent" />
          <h2 className="text-lg font-bold text-foreground-primary">Matchroom Instructions</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 p-5 rounded-xl bg-gradient-to-r from-accent/10 to-transparent border border-accent/25">
          <Home className="w-8 h-8 text-accent shrink-0 self-start" />
          <div className="space-y-2">
            <p className="text-foreground-primary font-semibold text-base">
              The Home Team ALWAYS Creates the Matchroom
            </p>
            <p className="text-sm text-foreground-secondary leading-relaxed">
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
              className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-bg-surface border border-border"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-foreground-secondary leading-snug">{step}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-foreground-muted pb-4">
        Rules last updated by EFA administration. All decisions by admins are final.
      </p>
    </div>
  )
}
