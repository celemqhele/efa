import { createAdminClient } from '@/lib/supabase/server'
import Shell from './_shell'

export default async function SchedulerPage({ searchParams }: { searchParams: Promise<{ tournamentId: string }> }) {
  const supabase = await createAdminClient()
  const { tournamentId } = await searchParams

  const { count } = await supabase
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .is('scheduled_date', null)

  return <Shell data={{ tournamentId, unscheduledCount: count ?? 0 }} />
}
