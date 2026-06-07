import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const tournament_id = searchParams.get('tournament_id')
  if (!tournament_id) return Response.json({ error: 'tournament_id required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  // 1. Fetch tournament settings
  const { data: tournament } = await adminSupabase
    .from('tournaments')
    .select('settings')
    .eq('id', tournament_id)
    .single()

  const settings = (tournament?.settings as any) || {}
  const qualifiersPerGroup = settings.qualifiers_per_group ?? 2

  // 2. Fetch group standings
  const { data: gs } = await adminSupabase
    .from('group_standings')
    .select('team_id, group_name, points, goals_for, goals_against, team:teams(name, logo_league_folder, logo_team_slug)')
    .eq('tournament_id', tournament_id)

  if (!gs?.length) return Response.json({ error: 'No group standings found' })

  // 3. Sort and pick
  const groups: Record<string, any[]> = {}
  gs.forEach((s: any) => {
    if (!groups[s.group_name]) groups[s.group_name] = []
    groups[s.group_name].push(s)
  })

  const sortedQualifiers: any[] = []
  Object.keys(groups).sort().forEach(name => {
    const sorted = [...groups[name]].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const gdA = (a.goals_for ?? 0) - (a.goals_against ?? 0)
      const gdB = (b.goals_for ?? 0) - (b.goals_against ?? 0)
      if (gdB !== gdA) return gdB - gdA
      return (b.goals_for ?? 0) - (a.goals_for ?? 0)
    })
    sortedQualifiers.push(...sorted.slice(0, qualifiersPerGroup))
  })

  return Response.json({ qualifiers: sortedQualifiers })
}
