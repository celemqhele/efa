import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateTBCKnockouts } from '@/lib/tournament-progression'
import { recalculateStandings } from '@/lib/standings-engine'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { tournament_id: string; manual_qualifiers?: string[]; num_legs?: number }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tournament_id, manual_qualifiers, num_legs } = body
  if (!tournament_id) return Response.json({ error: 'tournament_id required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  // Recalculate standings to ensure group_standings are up to date
  try { await recalculateStandings(tournament_id) } catch (e: any) {
    console.error('Standings recalculation failed:', e)
  }

  // Verify all group fixtures are confirmed (skip if manual qualifiers provided)
  const { count: pendingGroups } = await adminSupabase
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournament_id)
    .eq('round_type', 'group')
    .neq('status', 'confirmed')

  if ((pendingGroups ?? 1) > 0 && !manual_qualifiers) {
    return Response.json({ error: 'Not all group fixtures are confirmed yet' }, { status: 400 })
  }

  const result = await generateTBCKnockouts(adminSupabase, tournament_id, manual_qualifiers, num_legs ?? 1)
  if (result.error) {
    return Response.json({ error: result.error }, { status: result.error === 'Knockout fixtures already exist' ? 409 : 500 })
  }

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'generate_knockouts',
    target_type: 'tournament',
    target_id: tournament_id,
    details: { manual: true },
  })

  return Response.json({ success: true })
}
