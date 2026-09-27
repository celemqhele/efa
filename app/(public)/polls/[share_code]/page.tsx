import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { Metadata } from 'next'
import { buildRegistry } from '@/lib/registry'
import { filterTeamsByFolder } from '@/lib/allowed-teams'
import { resolveVoterFolders } from '@/lib/poll-voter-restrictions'
import { getSeasonPickableTeams } from '@/lib/season-applications'
import { ogMeta } from '@/lib/og'
import Shell from './_shell'

// Shared by generateMetadata and the page body so the link preview does not
// double the poll query on every request.
const getPoll = cache(async (supabase: any, shareCode: string) => {
  const { data } = await supabase
    .from('polls' as any)
    .select('*, created_by:profiles!polls_created_by_fkey(username)')
    .eq('share_code', shareCode)
    .maybeSingle()
  return data as any
})

export async function generateMetadata({ params }: { params: Promise<{ share_code: string }> }): Promise<Metadata> {
  const { share_code } = await params
  const supabase = await createClient()
  const poll = await getPoll(supabase, share_code)

  if (!poll) {
    return ogMeta({
      title: 'Poll not found',
      description: 'This EFA poll could not be found. It may have been removed.',
      path: `/polls/${share_code}`,
    })
  }

  const title = poll.title || 'EFA Poll'
  const creator = poll.created_by?.username
  const isClosed = poll.status === 'closed' || !!poll.closed_at

  // A poll is a vote, so the useful description is who is eligible to vote
  // rather than a restatement of the question.
  const eligibility =
    poll.voter_restrictions ? 'Open to selected members only' : 'Open to all EFA members'

  const description =
    `${poll.description ? `${poll.description} ` : ''}` +
    `${isClosed ? 'Voting has closed' : 'Cast your vote'} — ${eligibility.toLowerCase()}` +
    `${creator ? `. Poll by @${creator}.` : '.'}`

  return ogMeta({
    title,
    description,
    path: `/polls/${share_code}`,
    subtitle: [isClosed ? 'Voting closed' : 'Voting open', eligibility].join(' · '),
    badge: isClosed ? 'CLOSED' : 'VOTE',
  })
}

export default async function PollPage({ params }: { params: Promise<{ share_code: string }> }) {
  const { share_code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const poll = await getPoll(supabase, share_code)

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

  // Poll voter restrictions: an allowlist of user_id -> [league_folder, ...].
  // Absent = open to any authenticated user (legacy). Present = users only see
  // teams inside their allowed folders. A user created after the allowlist
  // snapshot falls back to the second-division folders (resolveVoterFolders)
  // instead of being locked out.
  const restrictions: Record<string, string[]> | null = poll.voter_restrictions ?? null
  const allowedFolders = user ? resolveVoterFolders(restrictions, user.id) : null
  const isEligible = !restrictions || (!!user && (allowedFolders ?? []).length > 0)

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
      if (allowedFolders && !allowedFolders.includes(key)) continue
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
    // Build team registry filtered by poll settings (and voter's allowed folders)
    const registry = await buildRegistry()
    leagues = registry
      .filter((r) => poll.allowed_leagues?.includes(r.folder))
      .filter((r) => !allowedFolders || allowedFolders.includes(r.folder))
      .map(l => ({ ...l, teams: filterTeamsByFolder(l.folder, l.teams) }))

    if (poll.allowed_international) {
      const intl = registry
        .filter((r) => r.isNational)
        .filter((r) => !allowedFolders || allowedFolders.includes(r.folder))
        .map(l => ({ ...l, teams: filterTeamsByFolder(l.folder, l.teams) }))
      leagues = [...leagues, ...intl]
    }
  }

  const userProfile = user
    ? await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single()
    : null

  const data = {
    poll: { ...poll, voter_restrictions: undefined },
    leagues,
    user: user ? { id: user.id, ...(userProfile?.data ?? {}) } : null,
    isSeasonLinked: !!poll.season_id,
    isEligible,
  }

  return <Shell data={data} />
}
