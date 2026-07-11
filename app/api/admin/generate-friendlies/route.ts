import { createAdminClient, createClient } from '@/lib/supabase/server'
import { generateExhibitionFixtures } from '@/lib/fixture-generator'
import { format } from 'date-fns'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { tournament_id: string; matches_per_team: number }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tournament_id, matches_per_team } = body
  if (!tournament_id || !matches_per_team) return Response.json({ error: 'tournament_id and matches_per_team required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  // 1. Get teams
  const { data: participants } = await adminSupabase
    .from('tournament_participants')
    .select('team_id')
    .eq('tournament_id', tournament_id)
  
  const teamIds = (participants ?? []).map(p => p.team_id)
  if (teamIds.length < 2) return Response.json({ error: 'Need at least 2 teams' }, { status: 400 })

  // 2. Generate fixtures
  const fixtures = await generateExhibitionFixtures(adminSupabase, teamIds, matches_per_team, format(new Date(), 'yyyy-MM-dd'), tournament_id)

  // 3. Insert fixtures
  const { error: fErr } = await adminSupabase.from('fixtures').insert(
    fixtures.map(f => ({
      ...f,
      tournament_id,
      round_type: null,
      is_postponed: false,
    }))
  )
  if (fErr) return Response.json({ error: fErr.message }, { status: 500 })

  return Response.json({ success: true, count: fixtures.length })
}
