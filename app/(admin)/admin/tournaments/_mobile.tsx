import Link from 'next/link'
import DeleteTournamentButton from './DeleteTournamentButton'
import GenerateFixturesButton from './GenerateFixturesButton'
import GenerateKnockoutsButton from './GenerateKnockoutsButton'
import RunTournamentDrawButton from './RunTournamentDrawButton'
import { Trophy } from 'lucide-react'

const MOBILE_ACTION_BTN =
  'text-xs font-semibold text-center px-2 py-3 rounded-lg border border-border text-text-secondary min-h-[48px] flex items-center justify-center transition-colors hover:border-accent hover:text-accent'

const MOBILE_ACTION_BTN_DANGER =
  'text-xs font-semibold text-center px-2 py-3 rounded-lg border border-red-500/30 text-red-400 min-h-[48px] flex items-center justify-center transition-colors hover:bg-red-500/10 hover:border-red-500/40'

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

function TournamentCard({ tournament, participantCount, fixtureCount, completedCount }: {
  tournament: any; participantCount: number; fixtureCount: number; completedCount: number
}) {
  const typeInfo = TYPE_LABELS[tournament.type] ?? { label: tournament.type, colour: 'text-text-muted bg-bg-surface0/10 border-slate-500/20' }
  const statusCls = STATUS_COLOURS[tournament.status] ?? STATUS_COLOURS.completed
  const progress = fixtureCount > 0 ? Math.round((completedCount / fixtureCount) * 100) : 0

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-text-primary font-bold text-base truncate">{tournament.name}</h3>
          {tournament.season && <p className="text-text-muted text-xs mt-0.5">{tournament.season.name}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${statusCls}`}>{tournament.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-bg-base rounded-lg py-3">
          <p className="text-accent font-bold text-lg">{participantCount}</p>
          <p className="text-text-muted text-[11px]">Teams</p>
        </div>
        <div className="bg-bg-base rounded-lg py-3">
          <p className="text-text-primary font-bold text-lg">{fixtureCount}</p>
          <p className="text-text-muted text-[11px]">Fixtures</p>
        </div>
        <div className="bg-bg-base rounded-lg py-3">
          <p className="text-green-400 font-bold text-lg">{completedCount}</p>
          <p className="text-text-muted text-[11px]">Played</p>
        </div>
      </div>

      {fixtureCount > 0 && (
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-2 pt-1">
        <div className="grid grid-cols-3 gap-2">
          <Link href={`/admin/fixtures/manage?tournament=${tournament.id}`} className={MOBILE_ACTION_BTN}>
            Fixtures
          </Link>
          <Link href={`/standings?t=${tournament.id}`} className={MOBILE_ACTION_BTN}>
            Standings
          </Link>
          <DeleteTournamentButton tournamentId={tournament.id} tournamentName={tournament.name} className={MOBILE_ACTION_BTN_DANGER} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <GenerateFixturesButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} className={MOBILE_ACTION_BTN} />
          <RunTournamentDrawButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} className={MOBILE_ACTION_BTN} />
          <GenerateKnockoutsButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} className={MOBILE_ACTION_BTN} />
        </div>
      </div>
    </div>
  )
}

export default function Mobile({ data }: { data: any }) {
  const { tournaments, participantCounts, fixtureCounts, completedCounts, grouped } = data

  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Tournaments</h1>
            <p className="text-xs text-text-muted mt-0.5">{(tournaments?.length ?? 0)} total</p>
          </div>
        </div>
        <Link href="/admin/tournaments/create" className="text-sm font-semibold px-5 py-3 rounded-lg bg-accent text-bg-surface min-h-[48px] flex items-center">
          + Create
        </Link>
      </div>

      {(tournaments?.length ?? 0) === 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-12 text-center space-y-3">
          <Trophy className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-base font-medium text-text-primary">No tournaments yet</p>
          <p className="text-sm text-text-muted">Create your first tournament to get started.</p>
          <Link href="/admin/tournaments/create" className="inline-block text-sm font-semibold px-5 py-3 rounded-lg bg-accent text-bg-surface min-h-[48px] leading-none">
            Create Tournament
          </Link>
        </div>
      )}

      {grouped.active.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-text-muted mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Active
          </h2>
          <div className="space-y-3">
            {grouped.active.map((t: any) => (
              <TournamentCard key={t.id} tournament={t} participantCount={participantCounts[t.id] ?? 0} fixtureCount={fixtureCounts[t.id] ?? 0} completedCount={completedCounts[t.id] ?? 0} />
            ))}
          </div>
        </section>
      )}

      {grouped.upcoming.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-text-muted mb-3">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Upcoming
          </h2>
          <div className="space-y-3">
            {grouped.upcoming.map((t: any) => (
              <TournamentCard key={t.id} tournament={t} participantCount={participantCounts[t.id] ?? 0} fixtureCount={fixtureCounts[t.id] ?? 0} completedCount={completedCounts[t.id] ?? 0} />
            ))}
          </div>
        </section>
      )}

      {grouped.completed.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-text-muted mb-3">
            Completed
          </h2>
          <div className="space-y-3 opacity-60">
            {grouped.completed.map((t: any) => (
              <TournamentCard key={t.id} tournament={t} participantCount={participantCounts[t.id] ?? 0} fixtureCount={fixtureCounts[t.id] ?? 0} completedCount={completedCounts[t.id] ?? 0} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
