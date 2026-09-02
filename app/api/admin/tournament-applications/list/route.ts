import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const adminSupabase = await createAdminClient()

  const { data, error } = await adminSupabase
    .from('tournament_applications')
    .select(`
      id, season_id, applicant_id, team_id, poll_id, status, review_note, expires_at, created_at,
      season:season_id(name),
      applicant:applicant_id(id, username),
      team:team_id(id, name),
      poll:poll_id(id, title)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((row: any) => ({
    ...row,
    season: Array.isArray(row.season) ? row.season[0] : row.season,
    applicant: Array.isArray(row.applicant) ? row.applicant[0] : row.applicant,
    team: Array.isArray(row.team) ? row.team[0] : row.team,
    poll: Array.isArray(row.poll) ? row.poll[0] : row.poll,
  }))

  return Response.json({ applications: rows })
}