import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSlotStateForDate, getDailyCapacity } from '@/lib/fixture-slots'
import { addDays, format } from 'date-fns'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { season_id: string; ucl_winner_id: string; europa_winner_id: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { season_id, ucl_winner_id, europa_winner_id } = body

  if (!season_id || !ucl_winner_id || !europa_winner_id) {
    return Response.json({ error: 'season_id, ucl_winner_id, and europa_winner_id are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()
  const db = (table: string) => adminSupabase.from(table) as any

  // Load season to get end_date
  const { data: season } = await db('seasons')
    .select('end_date, name')
    .eq('id', season_id)
    .single()

  if (!season) return Response.json({ error: 'Season not found' }, { status: 404 })

  // Check if a Super Cup tournament already exists for this season
  const { data: existingSC } = await db('tournaments')
    .select('id, status, fixture_count, completed_count')
    .eq('season_id', season_id)
    .eq('type', 'super_cup')
    .maybeSingle()

  if (existingSC?.fixture_count && existingSC.fixture_count > 0 && existingSC.completed_count < existingSC.fixture_count) {
    return Response.json({ error: 'Super Cup already exists and is not completed' }, { status: 409 })
  }

  // Fetch team names for the fixture
  const { data: teams } = await db('teams')
    .select('id, name')
    .in('id', [ucl_winner_id, europa_winner_id])

  if (!teams || teams.length !== 2) {
    return Response.json({ error: 'Could not find both winner teams' }, { status: 400 })
  }

  const teamMap = Object.fromEntries(teams.map((t: any) => [t.id, t.name]))
  const uclName = teamMap[ucl_winner_id] ?? 'UCL Winner'
  const europaName = teamMap[europa_winner_id] ?? 'Europa Winner'

  // Create or reuse Super Cup tournament
  let tournamentId: string
  if (existingSC) {
    tournamentId = existingSC.id
    // Clear old participants and fixtures
    await db('fixtures').delete().eq('tournament_id', tournamentId)
    await db('tournament_participants').delete().eq('tournament_id', tournamentId)
    await db('tournaments').update({ status: 'active' }).eq('id', tournamentId)
  } else {
    const { data: t } = await db('tournaments').insert({
      season_id,
      name: 'EFA Super Cup',
      type: 'super_cup',
      status: 'active',
      settings: { end_date: season.end_date },
    }).select('id').single()
    tournamentId = t.id
  }

  // Add participants
  await db('tournament_participants').insert([
    { tournament_id: tournamentId, team_id: ucl_winner_id },
    { tournament_id: tournamentId, team_id: europa_winner_id },
  ])

  // Assign fixture date: find the earliest available slot after the season's end - 3 days
  const scEnd = new Date(season.end_date)
  const seasonEnd = format(scEnd, 'yyyy-MM-dd')
  const earlyDate = format(addDays(scEnd, -3), 'yyyy-MM-dd')

  let bestDate: string | null = null
  let cursor = new Date(earlyDate)
  const endLimit = format(addDays(scEnd, 7), 'yyyy-MM-dd') // up to a week after season end

  while (format(cursor, 'yyyy-MM-dd') <= endLimit) {
    const dateStr = format(cursor, 'yyyy-MM-dd')
    const { globalCap } = getDailyCapacity(dateStr)
    const state = await getSlotStateForDate(adminSupabase, dateStr)
    if (state.globalUsed < globalCap) {
      bestDate = dateStr
      break
    }
    cursor = addDays(cursor, 1)
  }

  if (!bestDate) bestDate = format(addDays(scEnd, 1), 'yyyy-MM-dd')

  // Create the single fixture
  const { data: fixture } = await db('fixtures').insert({
    tournament_id: tournamentId,
    home_team_id: ucl_winner_id,
    away_team_id: europa_winner_id,
    matchday: 1,
    scheduled_date: bestDate,
    round_type: 'super_cup',
    leg: 1,
    status: 'scheduled',
    is_postponed: false,
  }).select('id').single()

  await db('audit_log').insert({
    admin_id: user.id,
    action: 'generate_super_cup',
    target_type: 'tournament',
    target_id: tournamentId,
    details: {
      season_id,
      ucl_winner: uclName,
      europa_winner: europaName,
      scheduled_date: bestDate,
    },
  })

  return Response.json({
    success: true,
    tournament_id: tournamentId,
    fixture_id: fixture.id,
    scheduled_date: bestDate,
    ucl_winner: uclName,
    europa_winner: europaName,
  })
}
