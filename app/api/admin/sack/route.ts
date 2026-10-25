import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertNotificationsAndPush } from '@/lib/notify'
import { forfeitUnmanagedClubSlots } from '@/lib/slot-utils'
import { recalculateManagerStats } from '@/lib/manager-stats-engine'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  // Accept both camelCase (from UserActionButtons) and snake_case (from TeamManageActions)
  const team_id: string = body.teamId ?? body.team_id

  if (!team_id) return Response.json({ error: 'teamId is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  const { data: team } = await adminSupabase
    .from('teams').select('id, name, manager_id, logo_league_folder, logo_team_slug').eq('id', team_id).single()

  if (!team) return Response.json({ error: 'Team not found' }, { status: 404 })
  if (!team.manager_id) return Response.json({ error: 'This team has no manager' }, { status: 400 })

  const sackedUserId = team.manager_id

  // Sibling rows share a club across competitions (e.g. a national side and its
  // league club); they all lose the manager together.
  let allClubIds: string[] = [team_id]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await adminSupabase
      .from('teams')
      .select('id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', team_id)
    allClubIds = [team_id, ...(siblings ?? []).map((s: any) => s.id as string)]
  }

  // Record sack time for the 1-week reassignment cooldown
  const now = new Date().toISOString()
  await adminSupabase.from('profiles').update({ sacked_at: now }).eq('id', sackedUserId)

  // ── Seal the active tenure ────────────────────────────────────────────────
  // Sealed for every sibling row, and sealed BEFORE the automatic forfeits below:
  // an open tenure would otherwise claim the future-dated 3-0s and hand the
  // sacked manager losses for matches played after they left. W/D/L are rebuilt
  // from the corrected attribution rule at the end instead of being calculated
  // here (the old date-only sum disagreed with the SQL trigger).
  await adminSupabase
    .from('manager_tenures' as any)
    .update({ ended_at: now })
    .in('team_id', allClubIds)
    .is('ended_at', null)

  // ── Release the team ──────────────────────────────────────────────────────
  const { error: updateError } = await adminSupabase
    .from('teams')
    .update({ manager_id: null, abandon_count: 0 })
    .in('id', allClubIds)

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  // The club keeps its identity: its seats drop ownership (no "Vacant"
  // relabel) and its remaining fixtures auto-forfeit 3-0.
  const { forfeits } = await forfeitUnmanagedClubSlots(adminSupabase, allClubIds)

  // Rebuild the sacked manager's record now that the forfeits exist: same-day
  // forfeits stay on their card, later ones land on nobody.
  await recalculateManagerStats(sackedUserId).catch((e) =>
    console.error('[admin/sack] recalc manager stats failed:', e)
  )

  // Notify sacked manager (in-app + push)
  await insertNotificationsAndPush(adminSupabase, {
    user_id: sackedUserId,
    type: 'sacking',
    title: 'You have been sacked',
    body: `Your management of ${team.name} has ended. You can pick a new team.`,
    data: { team_id, team_name: team.name },
  })

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'sack_manager',
    target_type: 'team',
    target_id: team_id,
    details: { sacked_user_id: sackedUserId, team_name: team.name, forfeits_scheduled: forfeits },
  })

  return Response.json({ success: true })
}
