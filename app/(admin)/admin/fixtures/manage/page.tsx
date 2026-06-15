import { createAdminClient } from '@/lib/supabase/server'
import { getAppTodayKey } from '@/lib/app-time'
import Shell from './_shell'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function FixturesManagePage({
  searchParams,
}: {
  searchParams: any
}) {
  const supabase = await createAdminClient()

  const resolvedParams = searchParams && typeof searchParams.then === 'function'
    ? await searchParams
    : searchParams

  const todayKey = await getAppTodayKey(supabase)
  const selectedDate = resolvedParams?.date ?? todayKey

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, round_type, scheduled_date, status, is_postponed, leg,
      tournament:tournaments(id, name, type),
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      result:results(home_score, away_score)
    `)
    .eq('scheduled_date', selectedDate)
    .order('scheduled_date', { ascending: true })

  return <Shell data={{ fixtures: fixtures ?? [], todayKey, selectedDate }} />
}
