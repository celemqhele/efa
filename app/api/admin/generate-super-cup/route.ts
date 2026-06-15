import { createClient, createAdminClient } from '@/lib/supabase/server'
import { addDays, format } from 'date-fns'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { season_id: string; ucl_winner_id: string; europa_winner_id: string }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { season_id, ucl_winner_id, europa_winner_id } = body
  if (!season_id || !ucl_winner_id || !europa_winner_id) {
    return Response.json({ error: 'season_id, ucl_winner_id, and europa_winner_id required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // 1. Get season dates to schedule the match
  const { data: season } = await adminSupabase
    .from('seasons')
    .select('start_date, end_date')
    .eq('id', season_id)
    .single()

  const startDate = season?.start_date ?? format(new Date(), 'yyyy-MM-dd')
  // Schedule Super Cup 2 days after start of phase
  const scheduledDate = format(addDays(new Date(startDate), 2), 'yyyy-MM-dd')

  // 2. Create the Super Cup tournament (using 'friendlies' type to match UI)
  const { data: tournament, error: tErr } = await adminSupabase
    .from('tournaments')
    .insert({
      season_id,
      name: 'EFA Super Cup',
      type: 'friendlies',
      status: 'active',
      settings: { is_super_cup: true },
    })
    .select('id')
    .single()

  if (tErr || !tournament) return Response.json({ error: tErr?.message ?? 'Failed to create tournament' }, { status: 500 })

  // 3. Add participants
  await adminSupabase.from('tournament_participants').insert([
    { tournament_id: tournament.id, team_id: ucl_winner_id },
    { tournament_id: tournament.id, team_id: europa_winner_id },
  ])

  // 4. Create the final fixture
  const { error: fErr } = await adminSupabase.from('fixtures').insert({
    tournament_id: tournament.id,
    home_team_id: ucl_winner_id,
    away_team_id: europa_winner_id,
    matchday: 1,
    round_type: 'final',
    status: 'scheduled',
    scheduled_date: scheduledDate,
    deadline: `${scheduledDate}T20:00:00Z`,
  })

  if (fErr) return Response.json({ error: fErr.message }, { status: 500 })

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'generate_super_cup',
    target_type: 'tournament',
    target_id: tournament.id,
    details: { season_id, ucl_winner_id, europa_winner_id },
  })

  return Response.json({ success: true, scheduled_date: scheduledDate })
}
