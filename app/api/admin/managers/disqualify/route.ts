import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertNotificationsAndPush } from '@/lib/notify'
import { vacateUserSlots } from '@/lib/slot-utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { team_id } = await request.json()
  if (!team_id) return Response.json({ error: 'team_id is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  const { data: team } = await adminSupabase
    .from('teams')
    .select('id, name, manager_id')
    .eq('id', team_id)
    .single()

  if (!team) return Response.json({ error: 'Team not found' }, { status: 404 })
  if (!team.manager_id) return Response.json({ error: 'Team has no manager to disqualify' }, { status: 400 })

  const disqualifiedUserId = team.manager_id

  // Disqualification only vacates the manager's tournament seat(s). Unlike a
  // full sack, it does NOT clear teams.manager_id, close tenures, or set a
  // reassignment cooldown — the manager keeps their club.
  const vacatedCount = await vacateUserSlots(adminSupabase, disqualifiedUserId)

  try {
    await insertNotificationsAndPush(adminSupabase, {
      user_id: disqualifiedUserId,
      type: 'disqualification',
      title: 'Disqualified from tournament',
      body: vacatedCount > 0
        ? `Your tournament seat for ${team.name} was vacated. You remain registered as the club's manager.`
        : `No tournament seats were found to vacate for ${team.name}. You remain registered as the club's manager.`,
      data: { team_id, team_name: team.name, slots_vacated: vacatedCount },
    })
  } catch (e) {
    console.error('[managers/disqualify] notify failed:', e)
  }

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'disqualify_manager',
    target_type: 'team',
    target_id: team_id,
    details: { team_name: team.name, disqualified_user_id: disqualifiedUserId, slots_vacated: vacatedCount },
  })

  return Response.json({ success: true, slots_vacated: vacatedCount })
}