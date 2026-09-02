export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const revalidate = 0

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

  const tournamentIds = ((tournaments ?? []) as any[])
    .map((t: any) => t.id)
    .filter((id: any): id is string => typeof id === 'string' && id.length > 0)

  // Participant counts
  const { data: participants } = tournamentIds.length
    ? await supabase
        .from('tournament_participants')
        .select('tournament_id')
        .in('tournament_id', tournamentIds)
    : { data: [] }

  const participantCounts: Record<string, number> = {}
  for (const p of (participants ?? []) as any[]) {
    participantCounts[p.tournament_id] = (participantCounts[p.tournament_id] ?? 0) + 1
  }

  // Fixture counts
  const { data: fixtures } = tournamentIds.length
    ? await supabase
        .from('fixtures')
        .select('tournament_id, status, round_type')
        .in('tournament_id', tournamentIds)
    : { data: [] }

  const fixtureCounts: Record<string, number> = {}
  const completedCounts: Record<string, number> = {}
  const koCounts: Record<string, number> = {}
  for (const f of (fixtures ?? []) as any[]) {
    fixtureCounts[f.tournament_id] = (fixtureCounts[f.tournament_id] ?? 0) + 1
    if (f.status === 'confirmed') {
      completedCounts[f.tournament_id] = (completedCounts[f.tournament_id] ?? 0) + 1
    }
    if (['r16', 'qf', 'sf', 'final'].includes(f.round_type)) {
      koCounts[f.tournament_id] = (koCounts[f.tournament_id] ?? 0) + 1
    }
  }

  const grouped = {
    active: ((tournaments ?? []) as any[]).filter((t: any) => t.status === 'active'),
    upcoming: ((tournaments ?? []) as any[]).filter((t: any) => t.status === 'upcoming'),
    completed: ((tournaments ?? []) as any[]).filter((t: any) => t.status === 'completed'),
  }

  return (
    <Shell
      data={{
        tournaments: tournaments ?? [],
        participantCounts,
        fixtureCounts,
        completedCounts,
        koCounts,
        grouped,
      }}
    />
  )
}