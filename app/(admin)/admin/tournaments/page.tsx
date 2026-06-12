export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DeleteTournamentButton from './DeleteTournamentButton'
import GenerateKnockoutsButton from './GenerateKnockoutsButton'

export const revalidate = 0

const TYPE_LABELS: Record<string, { label: string; colour: string }> = {
  league: { label: 'League', colour: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  ucl: { label: 'UCL', colour: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  europa: { label: 'Europa', colour: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  super_cup: { label: 'Super Cup', colour: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
}

const STATUS_COLOURS: Record<string, string> = {
  upcoming: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  active: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-text-muted bg-bg-surface0/10 border-slate-500/20',
}

export default async function TournamentsPage() {
  const supabase = await createClient()

  // Tournaments with seasons
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select(`
      id, name, type, status, created_at,
      season:seasons!tournaments_season_id_fkey(id, name, status)
    `)
    .order('created_at', { ascending: false })

  // Participant counts
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('tournament_id')

  const participantCounts: Record<string, number> = {}
  for (const p of (participants ?? []) as any[]) {
    participantCounts[p.tournament_id] = (participantCounts[p.tournament_id] ?? 0) + 1
  }

  // Fixture counts
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('tournament_id, status')

  const fixtureCounts: Record<string, number> = {}
  const completedCounts: Record<string, number> = {}
  for (const f of (fixtures ?? []) as any[]) {
    fixtureCounts[f.tournament_id] = (fixtureCounts[f.tournament_id] ?? 0) + 1
    if (f.status === 'confirmed') {
      completedCounts[f.tournament_id] = (completedCounts[f.tournament_id] ?? 0) + 1
    }
  }

  const grouped = {
    active: ((tournaments ?? []) as any[]).filter((t: any) => t.status === 'active'),
    upcoming: ((tournaments ?? []) as any[]).filter((t: any) => t.status === 'upcoming'),
    completed: ((tournaments ?? []) as any[]).filter((t: any) => t.status === 'completed'),
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground-primary">Tournaments</h1>
          <p className="text-text-muted text-sm mt-1">{(tournaments?.length ?? 0)} total tournaments</p>
        </div>
        <Link href="/admin/tournaments/create" className="btn-gold">
          + Create Tournament
        </Link>
      </div>

      {/* Active */}
      {grouped.active.length > 0 && (
        <section>
          <h2 className="section-header">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            Active
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.active.map((t: any) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                participantCount={participantCounts[t.id] ?? 0}
                fixtureCount={fixtureCounts[t.id] ?? 0}
                completedCount={completedCounts[t.id] ?? 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {grouped.upcoming.length > 0 && (
        <section>
          <h2 className="section-header">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
            Upcoming
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.upcoming.map((t: any) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                participantCount={participantCounts[t.id] ?? 0}
                fixtureCount={fixtureCounts[t.id] ?? 0}
                completedCount={completedCounts[t.id] ?? 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {grouped.completed.length > 0 && (
        <section>
          <h2 className="section-header text-text-muted">
            Completed
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
            {grouped.completed.map((t: any) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                participantCount={participantCounts[t.id] ?? 0}
                fixtureCount={fixtureCounts[t.id] ?? 0}
                completedCount={completedCounts[t.id] ?? 0}
              />
            ))}
          </div>
        </section>
      )}

      {(tournaments?.length ?? 0) === 0 && (
        <div className="card p-16 text-center text-text-muted">
          <p className="text-4xl mb-4">??</p>
          <p className="text-lg font-medium text-foreground-primary mb-2">No tournaments yet</p>
          <p className="text-sm mb-6">Create your first tournament to get started.</p>
          <Link href="/admin/tournaments/create" className="btn-gold">Create Tournament</Link>
        </div>
      )}
    </div>
  )
}

function TournamentCard({
  tournament,
  participantCount,
  fixtureCount,
  completedCount,
}: {
  tournament: any
  participantCount: number
  fixtureCount: number
  completedCount: number
}) {
  const typeInfo = TYPE_LABELS[tournament.type] ?? { label: tournament.type, colour: 'text-text-muted bg-bg-surface0/10 border-slate-500/20' }
  const statusCls = STATUS_COLOURS[tournament.status] ?? STATUS_COLOURS.completed
  const progress = fixtureCount > 0 ? Math.round((completedCount / fixtureCount) * 100) : 0

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-foreground-primary font-bold text-base truncate">{tournament.name}</h3>
          {tournament.season && (
            <p className="text-text-muted text-xs mt-0.5">{tournament.season.name}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded border ${statusCls}`}>{tournament.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-navy-light rounded-lg py-2">
          <p className="text-gold font-bold text-lg">{participantCount}</p>
          <p className="text-text-muted text-xs">Teams</p>
        </div>
        <div className="bg-navy-light rounded-lg py-2">
          <p className="text-foreground-primary font-bold text-lg">{fixtureCount}</p>
          <p className="text-text-muted text-xs">Fixtures</p>
        </div>
        <div className="bg-navy-light rounded-lg py-2">
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
          <div className="w-full h-1.5 bg-navy-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Link
          href={`/admin/fixtures/manage?tournament=${tournament.id}`}
          className="btn-outline text-xs flex-1 text-center"
        >
          Fixtures
        </Link>
        <GenerateKnockoutsButton 
          tournamentId={tournament.id} 
          tournamentName={tournament.name} 
          type={tournament.type} 
        />
        <Link
          href={`/standings?t=${tournament.id}`}
          className="btn-outline text-xs flex-1 text-center"
        >
          View
        </Link>
        <DeleteTournamentButton tournamentId={tournament.id} tournamentName={tournament.name} />
      </div>
    </div>
  )
}

