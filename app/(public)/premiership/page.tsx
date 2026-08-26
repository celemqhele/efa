import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Betway Premiership | EFA',
  description: 'The Betway Premiership is now available for selection. Pick your team for the upcoming season.',
  openGraph: {
    title: 'Betway Premiership | EFA',
    description: 'The Betway Premiership is now available for selection. Pick your team for the upcoming season.',
  },
}

const LEAGUE_FOLDER = 'south-african-premiership-2026-2027.football-logos.cc'

export default async function PremiershipPage() {
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .eq('logo_league_folder', LEAGUE_FOLDER)
    .order('name', { ascending: true })

  return <Shell teams={(teams ?? []) as any[]} />
}
