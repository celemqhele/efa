import { createClient } from '@/lib/supabase/server'
import { buildRegistry } from '@/lib/registry'
import { filterTeams } from '@/lib/allowed-teams'
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

  // Build team registry filtered by poll settings
  const registry = await buildRegistry()
  let leagues = registry
    .filter((r) => poll.allowed_leagues?.includes(r.folder))
    .map(l => ({ ...l, teams: filterTeams(l.teams) }))

  if (poll.allowed_international) {
    const intl = registry
      .filter((r) => r.isNational)
      .map(l => ({ ...l, teams: filterTeams(l.teams) }))
    leagues = [...leagues, ...intl]
  }

  const userProfile = user
    ? await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single()
    : null

  const data = {
    poll,
    leagues,
    user: user ? { id: user.id, ...(userProfile?.data ?? {}) } : null,
  }

  return <Shell data={data} />
}
