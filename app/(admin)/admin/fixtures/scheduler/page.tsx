import { createAdminClient } from '@/lib/supabase/server'
import FixtureScheduler from './FixtureScheduler'

export default async function SchedulerPage({ searchParams }: { searchParams: { tournamentId: string } }) {
  const supabase = createAdminClient()
  const { tournamentId } = await searchParams

  const { count } = await supabase
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .is('scheduled_date', null)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scheduling Dashboard</h1>
      <FixtureScheduler tournamentId={tournamentId} unscheduledCount={count ?? 0} />
    </div>
  )
}
