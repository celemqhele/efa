import { createClient, createAdminClient } from '@/lib/supabase/server'
import { LEAGUE_META } from '@/lib/registry'

export async function POST(request: Request, { params }: { params: Promise<{ share_code: string }> }) {
  const { share_code } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { team_name, team_slug, team_league } = body

  if (!team_name || !team_slug || !team_league) {
    return Response.json({ error: 'team_name, team_slug, and team_league are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Get poll
  const { data: poll } = await adminSupabase
    .from('polls' as any)
    .select('id, status, allowed_leagues, allowed_international')
    .eq('share_code', share_code)
    .single()

  if (!poll) return Response.json({ error: 'Poll not found' }, { status: 404 })
  if (poll.status !== 'open') return Response.json({ error: 'This poll is closed' }, { status: 400 })

  // Check if this team is already taken
  const { data: existing } = await adminSupabase
    .from('poll_applications' as any)
    .select('id')
    .eq('poll_id', poll.id)
    .eq('team_slug', team_slug)
    .eq('team_league', team_league)
    .neq('status', 'withdrawn')
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'This team has already been claimed' }, { status: 409 })
  }

  // Cleanup any lingering withdrawn applications for this team to avoid unique constraint violations
  await adminSupabase
    .from('poll_applications' as any)
    .delete()
    .eq('poll_id', poll.id)
    .eq('team_slug', team_slug)
    .eq('team_league', team_league)
    .eq('status', 'withdrawn')

  // National teams: only allow one application per user
  const meta = LEAGUE_META[team_league]
  if (meta?.isNational) {
    const { data: existingNational } = await adminSupabase
      .from('poll_applications' as any)
      .select('id')
      .eq('poll_id', poll.id)
      .eq('applicant_id', user.id)
      .neq('status', 'withdrawn')
      .maybeSingle()

    if (existingNational) {
      return Response.json({ error: 'You can only apply to one national team. Withdraw from your current application first.' }, { status: 409 })
    }
  }

  // Insert application
  const { data: app, error } = await adminSupabase
    .from('poll_applications' as any)
    .insert({
      poll_id: poll.id,
      applicant_id: user.id,
      team_name,
      team_slug,
      team_league,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ application: app })
}
