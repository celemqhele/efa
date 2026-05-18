import { DISCONNECT_RULES, OFFICIAL_RULES } from '@/lib/disconnect-rules'

export const revalidate = false // static

export default function RulesPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">EFA Rule Book</h1>
        <p className="text-sm text-slate-400 mt-1">
          Official match rules, disconnect protocols, and platform guidelines.
        </p>
      </div>

      {/* ── Section 1: Official Match Rules ── */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-[#c9a84c]" />
          <h2 className="text-lg font-bold text-white">EFA Official Match Rules</h2>
        </div>

        <ul className="space-y-2">
          {OFFICIAL_RULES.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-[#0f1a3d] border border-[#1e2d5a] hover:border-[#c9a84c]/30 transition-colors"
            >
              <span className="text-base leading-none mt-0.5 flex-shrink-0">{item.icon}</span>
              <span className="text-sm text-slate-200 leading-snug">{item.rule}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Section 2: Disconnect Rules ── */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-yellow-500" />
          <h2 className="text-lg font-bold text-white">Disconnect Rules</h2>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          If a disconnect occurs during a match, the restart duration is determined by the minute
          the disconnect happened. Aggregate score from the abandoned segment is always carried
          forward.
        </p>

        <div className="overflow-x-auto rounded-lg border border-[#1e2d5a]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f1a3d] border-b border-[#1e2d5a]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#c9a84c] uppercase tracking-wider">
                  Disconnect At
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#c9a84c] uppercase tracking-wider">
                  Restart Duration
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#c9a84c] uppercase tracking-wider">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {DISCONNECT_RULES.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-[#1e2d5a]/60 hover:bg-white/[0.03] transition-colors ${
                    i % 2 === 0 ? '' : 'bg-[#0f1a3d]/40'
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-[#c9a84c] font-semibold text-sm whitespace-nowrap">
                    {row.minute}
                  </td>
                  <td className="px-4 py-3 text-white text-sm">{row.restart}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 3: Abandonment Rules ── */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-red-500" />
          <h2 className="text-lg font-bold text-white">Abandonment Rules</h2>
        </div>

        <div className="space-y-3">
          {/* Waiting window */}
          <div className="flex gap-3 p-4 rounded-lg bg-[#0f1a3d] border border-[#1e2d5a]">
            <span className="text-xl flex-shrink-0">⏰</span>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Reporting Window</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                The <span className="text-[#c9a84c] font-medium">Report Waiting</span> button is
                available from <span className="text-white font-medium">13:00 to 14:05 SAST</span>.
                Only use it if your opponent has not shown up for the scheduled fixture.
              </p>
            </div>
          </div>

          {/* Outcome rules */}
          <div className="space-y-2">
            <div className="flex gap-3 p-3.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="text-lg flex-shrink-0">🏠</span>
              <p className="text-sm text-slate-200 leading-snug">
                If the <span className="text-green-400 font-semibold">home team</span> submits a
                waiting report and the away team does not respond, the{' '}
                <span className="text-green-400 font-semibold">away team receives an auto-loss</span>.
              </p>
            </div>

            <div className="flex gap-3 p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <span className="text-lg flex-shrink-0">✈️</span>
              <p className="text-sm text-slate-200 leading-snug">
                If the <span className="text-blue-400 font-semibold">away team</span> submits a
                waiting report and the home team does not respond, the{' '}
                <span className="text-blue-400 font-semibold">home team receives an auto-loss</span>.
              </p>
            </div>

            <div className="flex gap-3 p-3.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
              <span className="text-lg flex-shrink-0">🤝</span>
              <p className="text-sm text-slate-200 leading-snug">
                If <span className="text-slate-300 font-semibold">neither team</span> submits a
                waiting report, the fixture is recorded as a{' '}
                <span className="text-slate-300 font-semibold">0–0 draw with no points</span> awarded
                to either side.
              </p>
            </div>

            <div className="flex gap-3 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-lg flex-shrink-0">⚠️</span>
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

      {/* ── Section 4: Matchroom Instructions ── */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 rounded-full bg-[#c9a84c]" />
          <h2 className="text-lg font-bold text-white">Matchroom Instructions</h2>
        </div>

        <div className="flex gap-4 p-5 rounded-xl bg-gradient-to-r from-[#c9a84c]/10 to-transparent border border-[#c9a84c]/25">
          <div className="text-3xl flex-shrink-0">🏠</div>
          <div className="space-y-2">
            <p className="text-white font-semibold text-base">
              The Home Team ALWAYS Creates the Matchroom
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              In eFootball, it is the responsibility of the{' '}
              <span className="text-[#c9a84c] font-semibold">home team</span> — as listed in the
              fixture — to open and host the matchroom. The away team joins the room created by the
              home team.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Make sure you check the fixture card to confirm which team is home before
              your scheduled kick-off time. Failure to create the matchroom as the home team may
              result in a waiting report being filed against you.
            </p>
          </div>
        </div>

        {/* Quick checklist */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
              className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-[#0f1a3d] border border-[#1e2d5a]"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#c9a84c]/20 text-[#c9a84c] text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-slate-300 leading-snug">{step}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <p className="text-center text-xs text-slate-600 pb-4">
        Rules last updated by EFA administration. All decisions by admins are final.
      </p>
    </div>
  )
}
