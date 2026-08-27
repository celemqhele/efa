import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'South African Leagues | EFA',
  description: 'The Betway Premiership, Motsepe Foundation Championship, and ABC Motsepe League are now available for selection. Pick your team for the upcoming season.',
  openGraph: {
    title: 'South African Leagues | EFA',
    description: 'The Betway Premiership, Motsepe Foundation Championship, and ABC Motsepe League are now available for selection.',
  },
}

const LEAGUES = [
  { folder: 'south-african-premiership-2026-2027.football-logos.cc', name: 'Betway Premiership', tier: 'Division 1' },
  { folder: 'motsepe-foundation-championship-2026-2027.football-logos.cc', name: 'Motsepe Foundation Championship', tier: 'Division 2' },
  { folder: 'abc-motsepe-league-2026-2027.football-logos.cc', name: 'ABC Motsepe League', tier: 'Division 3' },
]

export default async function PremiershipPage() {
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .in('logo_league_folder', LEAGUES.map(l => l.folder))
    .order('name', { ascending: true })

  const leagues = LEAGUES.map(league => ({
    ...league,
    teams: (teams ?? []).filter((t: any) => t.logo_league_folder === league.folder),
  }))

  return <Shell leagues={leagues as any} />
}
