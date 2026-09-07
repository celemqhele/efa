import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { loadStandingsPageData } from '@/lib/standings-page'
import Shell from '@/app/(public)/standings/_shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Standings',
  description: 'EFA league standings — see how teams rank across all tournaments.',
}

interface PageProps {
  searchParams: Promise<{ tournament?: string }>
}

export default async function AdminStandingsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const selectedTournamentId = params.tournament ?? null

  const data = await loadStandingsPageData(supabase, selectedTournamentId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Standings</h1>
      </div>
      <Shell data={data} />
    </div>
  )
}