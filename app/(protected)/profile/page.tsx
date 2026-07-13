export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Shell from './_shell'

export const revalidate = 0

export default async function ProfilePage() {
  const supabase = await createClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Profile
  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('id, username, role, avatar_url, theme_preferences, phone')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as any

  // Fetch all team rows for the user - same club can appear across multiple phases
  const { data: allTeamRows } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .eq('manager_id', user.id)
  const team = (allTeamRows?.[0] as any) ?? null
  const teamIds: string[] = (allTeamRows ?? []).map((t: any) => t.id)
  const teamOrFilter = teamIds.length > 0
    ? teamIds.flatMap(id => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`]).join(',')
    : null

  // Fetch Tenures (Career History)
  const { data: tenures } = await supabase
    .from('manager_tenures' as any)
    .select(`
      *,
      team:teams(id, name, logo_league_folder, logo_team_slug)
    `)
    .eq('manager_id', user.id)
    .order('started_at', { ascending: false }) as any

  // Calculate Aggregated Stats
  const stats = (tenures ?? []).reduce((acc: any, t: any) => {
    acc.played += (t.wins + t.draws + t.losses)
    acc.wins += t.wins
    acc.draws += t.draws
    acc.losses += t.losses
    acc.gf += t.goals_for
    acc.ga += t.goals_against
    return acc
  }, { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 })

  const winRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0

  // Upcoming fixtures (next 5 for user's team - covers all phase rows)
  const { data: upcomingFixtures } = teamOrFilter
    ? await supabase
        .from('fixtures')
        .select(`
          id, scheduled_date, matchday, round_type,
          home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
          tournament:tournaments(name, type)
        `)
        .or(teamOrFilter)
        .eq('status', 'scheduled')
        .order('scheduled_date', { ascending: true })
        .limit(5)
    : { data: null }

  const next3 = (upcomingFixtures ?? []).slice(0, 3) as any[]

  const data = {
    user,
    profile,
    team,
    teamIds,
    tenures,
    stats,
    winRate,
    next3,
  }

  return <Shell data={data} />
}
