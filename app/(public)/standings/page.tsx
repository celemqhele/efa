import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { buildLiveStandings } from '@/lib/standings-core'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Standings',
  description: 'EFA league standings — see how teams rank across all tournaments.',
  openGraph: { title: 'Standings | EFA', description: 'EFA league standings — see how teams rank across all tournaments.' },
}

interface PageProps {
  searchParams: Promise<{ tournament?: string }>
}

export default async function StandingsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const selectedTournamentId = params.tournament ?? null

  const { data: _tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status, settings')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  const tournaments = (_tournaments ?? []) as any[]

  const requestedTournament = selectedTournamentId
    ? tournaments?.find((t: any) => t.id === selectedTournamentId)
    : null

  const activeTournamentId = requestedTournament?.id ?? tournaments?.[0]?.id ?? null
  const activeTournament = tournaments?.find((t: any) => t.id === activeTournamentId)

  let leagueStandings: any[] = []
  let groupStandings: Record<string, any[]> = {}

  if (activeTournamentId && activeTournament) {
    const result = await buildLiveStandings(supabase, activeTournamentId, activeTournament.type)
    leagueStandings = result.leagueStandings
    groupStandings = result.groupStandings
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Standings</h1>
      </div>
      <Shell data={{ tournaments, activeTournamentId, activeTournament, leagueStandings, groupStandings }} />
    </div>
  )
}
