import { createClient } from '@/lib/supabase/server'
import { buildRegistry } from '@/lib/registry'
import { filterTeamsByFolder } from '@/lib/allowed-teams'
import { getSeasonPickableTeams } from '@/lib/season-applications'
import Shell from './_shell'

export default async function PollPage({ params }: { params: Promise<{ share_code: string }> }) {
  const { share_code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: poll } = await supabase
    .from('polls' as any)
    .select('*, created_by:profiles!polls_created_by_fkey(username)')
    .eq('share_code', share_code)
    .maybeSingle()

  if (!poll) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center space-y-space-4">
          <p className="text-4xl">404</p>
          <p className="text-text-muted">Poll not found</p>
        </div>
      </div>
    )
  }

  let leagues: any[] = []
  let seasonPickableTeams: { id: string; name: string; logo_league_folder: string; logo_team_slug: string }[] = []

  // If poll is linked to a season, get pickable teams for that season
  if (poll.season_id) {
    const pickableTeams = await getSeasonPickableTeams(supabase, poll.season_id)
    seasonPickableTeams = pickableTeams.map(t => ({
      id: t.id,
      name: t.name,
      logo_league_folder: t.logo_league_folder,
      logo_team_slug: t.logo_team_slug,
    }))
    
    // Build leagues from pickable teams
    const leagueMap = new Map<string, { folder: string; region: string; country: string; league: string; isNational?: boolean; teams: { slug: string; name: string }[] }>()
    
    for (const team of seasonPickableTeams) {
      const key = team.logo_league_folder
      if (!leagueMap.has(key)) {
        // Find league info from registry
        const registry = await buildRegistry()
        const leagueInfo = registry.find(r => r.folder === key)
        leagueMap.set(key, {
          folder: key,
          region: leagueInfo?.region ?? '',
          country: leagueInfo?.country ?? '',
          league: leagueInfo?.league ?? '',
          isNational: leagueInfo?.isNational ?? false,
          teams: [],
        })
      }
      leagueMap.get(key)!.teams.push({ slug: team.logo_team_slug, name: team.name })
    }
    
    leagues = Array.from(leagueMap.values())
  } else {
    // Build team registry filtered by poll settings
    const registry = await buildRegistry()
    leagues = registry
      .filter((r) => poll.allowed_leagues?.includes(r.folder))
      .map(l => ({ ...l, teams: filterTeamsByFolder(l.folder, l.teams) }))

    if (poll.allowed_international) {
      const intl = registry
        .filter((r) => r.isNational)
        .map(l => ({ ...l, teams: filterTeamsByFolder(l.folder, l.teams) }))
      leagues = [...leagues, ...intl]
    }
  }

  const userProfile = user
    ? await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single()
    : null

  const data = {
    poll,
    leagues,
    user: user ? { id: user.id, ...(userProfile?.data ?? {}) } : null,
    isSeasonLinked: !!poll.season_id,
  }

  return <Shell data={data} />
}
