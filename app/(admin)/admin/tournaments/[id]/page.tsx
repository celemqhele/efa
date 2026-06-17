export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DeleteTournamentButton from '../DeleteTournamentButton'
import RunTournamentDrawButton from '../RunTournamentDrawButton'
import GenerateKnockoutsButton from '../GenerateKnockoutsButton'
import GenerateFriendliesButton from '../GenerateFriendliesButton'
import { Trophy, ArrowLeft } from 'lucide-react'

const TYPE_LABELS: Record<string, { label: string; colour: string }> = {
  league: { label: 'League', colour: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  tournament_club: { label: 'Tournament (Clubs)', colour: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  tournament_international: { label: 'Tournament (Intl)', colour: 'text-green-400 bg-green-500/10 border-green-500/20' },
  friendlies: { label: 'Friendly', colour: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
}

function getSeasonName(season: any): string | null {
  if (!season) return null
  return Array.isArray(season) ? season[0]?.name ?? null : season.name ?? null
}

const STATUS_COLOURS: Record<string, string> = {
  upcoming: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  active: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-text-muted bg-bg-surface0/10 border-slate-500/20',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select(`
      id, name, type, status, created_at,
      season:seasons!tournaments_season_id_fkey(id, name, status)
    `)
    .eq('id', id)
    .single()

  if (!tournament) notFound()

  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('tournament_id', id)

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('status')
    .eq('tournament_id', id)

  const participantCount = (participants ?? []).length
  const fixtureCount = (fixtures ?? []).length
  const completedCount = (fixtures ?? []).filter((f: any) => f.status === 'confirmed').length
  const progress = fixtureCount > 0 ? Math.round((completedCount / fixtureCount) * 100) : 0

  const typeInfo = TYPE_LABELS[tournament.type] ?? { label: tournament.type, colour: 'text-text-muted bg-bg-surface0/10 border-slate-500/20' }
  const statusCls = STATUS_COLOURS[tournament.status] ?? STATUS_COLOURS.completed

  return (
    <div className="px-4 pb-8 max-w-lg mx-auto space-y-5">
      <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="bg-bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-text-primary truncate">{tournament.name}</h1>
            {getSeasonName(tournament.season) && (
              <p className="text-text-muted text-xs mt-0.5">{getSeasonName(tournament.season)}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[11px] px-2 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded border ${statusCls}`}>{tournament.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-bg-base border border-border rounded-xl py-3">
            <p className="text-accent font-bold text-xl">{participantCount}</p>
            <p className="text-text-muted text-[11px]">Teams</p>
          </div>
          <div className="bg-bg-base border border-border rounded-xl py-3">
            <p className="text-text-primary font-bold text-xl">{fixtureCount}</p>
            <p className="text-text-muted text-[11px]">Fixtures</p>
          </div>
          <div className="bg-bg-base border border-border rounded-xl py-3">
            <p className="text-green-400 font-bold text-xl">{completedCount}</p>
            <p className="text-text-muted text-[11px]">Played</p>
          </div>
        </div>

        {fixtureCount > 0 && (
          <div>
            <div className="flex justify-between text-xs text-text-muted mb-1.5">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <Link
            href={`/admin/fixtures/manage?tournament=${tournament.id}`}
            className="flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl bg-accent text-bg-surface min-h-[48px]"
          >
            <Trophy className="w-4 h-4" />
            Manage Fixtures
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/standings?t=${tournament.id}`}
              className="text-sm font-semibold text-center px-3 py-3 rounded-xl border border-border text-text-secondary min-h-[48px] flex items-center justify-center"
            >
              Standings
            </Link>
            <DeleteTournamentButton tournamentId={tournament.id} tournamentName={tournament.name} />
          </div>

          {['tournament_club', 'tournament_international'].includes(tournament.type) && (
            <div className="grid grid-cols-2 gap-2">
              <RunTournamentDrawButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} />
              <GenerateKnockoutsButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} />
            </div>
          )}

          {tournament.type === 'friendlies' && (
            <GenerateFriendliesButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} />
          )}
        </div>
      </div>
    </div>
  )
}
