import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const seasonId = searchParams.get('season_id')

  if (!seasonId) {
    return Response.json({ error: 'season_id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = await createAdminClient()

  // Get all pending/approved/denied/expired applications for this user in this season
  const { data: myApps } = await adminSupabase
    .from('tournament_applications' as any)
    .select('id, team_id, status, created_at, team:team_id(id, name, logo_league_folder, logo_team_slug)')
    .eq('season_id', seasonId)
    .eq('applicant_id', user.id)
    .in('status', ['pending', 'approved', 'denied', 'expired'])
    .order('created_at', { ascending: false })

  // Get all taken slots (pending + approved) for this season
  const { data: allApps } = await adminSupabase
    .from('tournament_applications' as any)
    .select('team_id, team:team_id(logo_league_folder, logo_team_slug)')
    .eq('season_id', seasonId)
    .in('status', ['pending', 'approved'])

  const takenSlots = new Set<string>()
  for (const app of allApps ?? []) {
    const team = Array.isArray(app.team) ? app.team[0] : app.team
    if (team?.logo_league_folder && team?.logo_team_slug) {
      takenSlots.add(`${team.logo_league_folder}|${team.logo_team_slug}`)
    }
  }

  const formattedApps = (myApps ?? []).map((app: any) => {
    const team = Array.isArray(app.team) ? app.team[0] : app.team
    return {
      id: app.id,
      team_slug: team?.logo_team_slug ?? '',
      team_league: team?.logo_league_folder ?? '',
      team_name: team?.name ?? 'Unknown',
      status: app.status,
    }
  })

  return Response.json({
    taken_slots: Array.from(takenSlots),
    my_applications: formattedApps,
  })
}