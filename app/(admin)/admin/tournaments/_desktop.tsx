import Link from 'next/link'
import DeleteTournamentButton from './DeleteTournamentButton'
import GenerateFixturesButton from './GenerateFixturesButton'
import GenerateKnockoutsButton from './GenerateKnockoutsButton'
import RunTournamentDrawButton from './RunTournamentDrawButton'
import { CARD_ACTION_BTN, CARD_ACTION_BTN_DANGER } from './card-action-classes'
import { Trophy } from 'lucide-react'

const TYPE_LABELS: Record<string, { label: string; colour: string }> = {
  league: { label: 'League', colour: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  tournament_club: { label: 'Tournament (Clubs)', colour: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  tournament_international: { label: 'Tournament (Intl)', colour: 'text-green-400 bg-green-500/10 border-green-500/20' },
  friendlies: { label: 'Friendly', colour: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
}

const STATUS_COLOURS: Record<string, string> = {
  upcoming: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  active: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-text-muted bg-bg-surface0/10 border-slate-500/20',
}

export default function Desktop({ data }: { data: any }) {
  const { tournaments, participantCounts, fixtureCounts, completedCounts, grouped } = data

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tournaments</h1>
          <p className="text-sm text-text-muted mt-1">{(tournaments?.length ?? 0)} total tournaments</p>
        </div>
        <Link href="/admin/tournaments/create" className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-accent text-bg-surface hover:bg-accent-hover transition-colors">
          + Create Tournament
        </Link>
      </div>

      {(tournaments?.length ?? 0) === 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-16 text-center space-y-4">
          <Trophy className="w-12 h-12 text-text-muted mx-auto" />
          <p className="text-lg font-medium text-text-primary">No tournaments yet</p>
          <p className="text-sm text-text-muted">Create your first tournament to get started.</p>
          <Link href="/admin/tournaments/create" className="inline-block text-sm font-semibold px-5 py-2.5 rounded-lg bg-accent text-bg-surface hover:bg-accent-hover transition-colors">
            Create Tournament
          </Link>
        </div>
      )}

      {['active', 'upcoming', 'completed'].map((status) => {
        const items = grouped[status] ?? []
        if (items.length === 0) return null
        return (
          <section key={status} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
              <h2 className="text-base font-bold text-text-primary capitalize">{status}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-base border-b-2 border-accent/20">
                    <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Name</th>
                    <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Season</th>
                    <th className="text-center text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Type</th>
                    <th className="text-center text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Status</th>
                    <th className="text-center text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Teams</th>
                    <th className="text-center text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Fixtures</th>
                    <th className="text-center text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Played</th>
                    <th className="text-center text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Progress</th>
                    <th className="text-right text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t: any) => {
                    const pc = participantCounts[t.id] ?? 0
                    const fc = fixtureCounts[t.id] ?? 0
                    const cc = completedCounts[t.id] ?? 0
                    const progress = fc > 0 ? Math.round((cc / fc) * 100) : 0
                    const typeInfo = TYPE_LABELS[t.type] ?? { label: t.type, colour: 'text-text-muted bg-bg-surface0/10 border-slate-500/20' }
                    const statusCls = STATUS_COLOURS[t.status] ?? STATUS_COLOURS.completed
                    return (
                      <tr key={t.id} className="border-b border-border hover:bg-bg-base/60 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-semibold text-text-primary">{t.name}</span>
                        </td>
                        <td className="px-5 py-4 text-text-muted text-xs">{t.season?.name ?? '—'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${statusCls}`}>{t.status}</span>
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-text-primary">{pc}</td>
                        <td className="px-5 py-4 text-center text-text-secondary">{fc}</td>
                        <td className="px-5 py-4 text-center text-green-400 font-semibold">{cc}</td>
                        <td className="px-5 py-4">
                          {fc > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-text-muted w-8 text-right">{progress}%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/admin/fixtures/manage?tournament=${t.id}`} className={CARD_ACTION_BTN}>
                              Fixtures
                            </Link>
                            <Link href={`/standings?t=${t.id}`} className={CARD_ACTION_BTN}>
                              Standings
                            </Link>
                            <DeleteTournamentButton tournamentId={t.id} tournamentName={t.name} className={CARD_ACTION_BTN_DANGER} />
                            <GenerateFixturesButton tournamentId={t.id} tournamentName={t.name} type={t.type} className={CARD_ACTION_BTN} />
                            <RunTournamentDrawButton tournamentId={t.id} tournamentName={t.name} type={t.type} className={CARD_ACTION_BTN} />
                            <GenerateKnockoutsButton tournamentId={t.id} tournamentName={t.name} type={t.type} className={CARD_ACTION_BTN} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
