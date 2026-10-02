import { createClient, createAdminClient } from '@/lib/supabase/server'
import { assignManagerToClub, resolveOrCreateTeam } from '@/lib/manager-mgmt'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { team_id, user_id, logo_league_folder, logo_team_slug, name, override } = await request.json()
  if (!user_id || (!team_id && (!logo_league_folder || !logo_team_slug))) {
    return Response.json({ error: 'user_id and (team_id or logo info) are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  const resolved = await resolveOrCreateTeam(adminSupabase, team_id, {
    folder: logo_league_folder,
    slug: logo_team_slug,
    name,
  })
  if (!resolved.ok) return Response.json({ error: resolved.message }, { status: 500 })

  const result = await assignManagerToClub(adminSupabase, {
    teamId: resolved.teamId,
    userId: user_id,
    adminId: user.id,
    override: !!override,
  })

  if (!result.ok) {
    if (result.code === 'SACK_COOLDOWN') {
      return Response.json(
        {
          error: `This manager was recently sacked. Wait until ${result.cooldownEndsAt} before reassigning.`,
          code: 'SACK_COOLDOWN',
          cooldown_ends_at: result.cooldownEndsAt,
        },
        { status: 409 }
      )
    }
    return Response.json({ error: result.message }, { status: 400 })
  }

  if (result.action === 'claim') {
    return Response.json({
      success: true,
      action: 'claim',
      filled: result.filled,
      message: result.filled > 0
        ? `No club found for @${result.username} — the seat is claimed (still shows as Vacant) until they get a club.`
        : `No club found for @${result.username} and no vacant seats to claim.`,
    })
  }

  if (result.action === 'fill') {
    return Response.json({
      success: true,
      action: 'fill',
      filled: result.filled,
      club: result.clubName,
      message: result.filled > 0
        ? `${result.clubName ?? '@' + result.username} has taken over the vacant seat.`
        : `No vacant seat was found for ${result.clubName ?? '@' + result.username} to fill.`,
    })
  }

  return Response.json({ success: true })
}