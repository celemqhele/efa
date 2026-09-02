import Link from 'next/link'
import DeleteTournamentButton from './DeleteTournamentButton'
import GenerateFixturesButton from './GenerateFixturesButton'
import GenerateKnockoutsButton from './GenerateKnockoutsButton'
import GenerateFriendliesButton from './GenerateFriendliesButton'
import RescheduleFixturesButton from './RescheduleFixturesButton'
import RunTournamentDrawButton from './RunTournamentDrawButton'
import { CARD_ACTION_BTN, CARD_ACTION_BTN_DANGER } from './card-action-classes'
import { Trophy } from 'lucide-react'

const TYPE_LABELS: Record<string, { label: string; colour: string }> = {
  league: { label: 'League', colour: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  tournament_club: { label: 'Cup (Clubs)', colour: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  tournament_international: { label: 'Cup (Intl)', colour: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  friendlies: { label: 'Friendly', colour: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
}

const STATUS_COLOURS: Record<string, string> = {
  upcoming: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  active: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-text-muted bg-bg-surface0/10 border-slate-500/20',
}

function TournamentCard({ tournament, participantCount, fixtureCount, completedCount, knockoutCount }: {
  tournament: any; participantCount: number; fixtureCount: number; completedCount: number; knockoutCount: number
}) {
  const typeInfo = TYPE_LABELS[tournament.type] ?? { label: tournament.type, colour: 'text-text-muted bg-bg-surface0/10 border-slate-500/20' }
  const statusCls = STATUS_COLOURS[tournament.status] ?? STATUS_COLOURS.completed
  const progress = fixtureCount > 0 ? Math.round((completedCount / fixtureCount) * 100) : 0
  const isClubType = tournament.type === 'tournament_club' || tournament.type === 'tournament_international'
  const isFriendly = tournament.type === 'friendlies'

  // Order the actions so it reads cleanly: core links first, then tool actions,
  // then the destructive delete (which spans the full width when the total is odd).
  const actionCount = 4 + (fixtureCount > 0 ? 1 : 0) + (isClubType ? 1 : 0) + (isFriendly ? 1 : 0)
  const deleteClass = `${CARD_ACTION_BTN_DANGER}${actionCount % 2 === 1 ? ' md:col-span-2' : ''}`

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-text-primary font-bold text-base truncate">{tournament.name}</h3>
          {tournament.season && (
            <p className="text-text-muted text-xs mt-0.5">{tournament.season.name}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${statusCls}`}>{tournament.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-bg-base border border-border rounded-lg py-2">
          <p className="text-accent font-bold text-lg">{participantCount}</p>
          <p className="text-text-muted text-xs">Teams</p>
        </div>
        <div className="bg-bg-base border border-border rounded-lg py-2">
          <p className="text-text-primary font-bold text-lg">{fixtureCount}</p>
          <p className="text-text-muted text-xs">Fixtures</p>
        </div>
        <div className="bg-bg-base border border-border rounded-lg py-2">
          <p className="text-green-400 font-bold text-lg">{completedCount}</p>
          <p className="text-text-muted text-xs">Played</p>
        </div>
      </div>

      {fixtureCount > 0 && (
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-3 border-t border-border">
        <Link href={`/admin/fixtures/manage?tournament=${tournament.id}`} className={CARD_ACTION_BTN}>
          Fixtures
        </Link>
        <Link href={`/standings?tournament=${tournament.id}`} className={CARD_ACTION_BTN}>
          Standings
        </Link>
        <GenerateFixturesButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} hasFixtures={fixtureCount > 0} className={CARD_ACTION_BTN} />
        <RescheduleFixturesButton tournamentId={tournament.id} tournamentName={tournament.name} fixtureCount={fixtureCount} className={CARD_ACTION_BTN} />
        {isClubType && (
          <RunTournamentDrawButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} className={CARD_ACTION_BTN} />
        )}
        {isClubType && (
          <GenerateKnockoutsButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} hasKnockouts={knockoutCount > 0} className={CARD_ACTION_BTN} />
        )}
        {isFriendly && (
          <GenerateFriendliesButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} className={CARD_ACTION_BTN} />
        )}
        <DeleteTournamentButton tournamentId={tournament.id} tournamentName={tournament.name} className={deleteClass} />
      </div>
    </div>
  )
}

export default function Desktop({ data }: { data: any }) {
  const { tournaments, participantCounts, fixtureCounts, completedCounts, koCounts, grouped } = data

  return (
    <div className="max-w-7xl mx-auto space-y-8">
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

      {[['active', 'Active', 'bg-green-400 animate-pulse'], ['upcoming', 'Upcoming', 'bg-yellow-400'], ['completed', 'Completed', 'bg-slate-400']].map(([status, label, dot]) => {
        const items = grouped[status] ?? []
        if (items.length === 0) return null
        return (
          <section key={status}>
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-text-muted mb-3">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {label} <span className="text-text-muted/50 font-bold">{items.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((t: any) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  participantCount={participantCounts[t.id] ?? 0}
                  fixtureCount={fixtureCounts[t.id] ?? 0}
                  completedCount={completedCounts[t.id] ?? 0}
                  knockoutCount={koCounts?.[t.id] ?? 0}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
