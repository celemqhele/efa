import { createClient, createAdminClient } from '@/lib/supabase/server'
import { recalculateStandings } from '@/lib/standings-engine'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Check admin role
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { fixture_id: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { fixture_id } = body
  if (!fixture_id) return Response.json({ error: 'fixture_id required' }, { status: 400 })

  const db = await createAdminClient()

  // 1. Fetch fixture to get tournament_id and current status
  const { data: fixture, error: fixErr } = await db
    .from('fixtures')
    .select('tournament_id, status')
    .eq('id', fixture_id)
    .single()

  if (fixErr || !fixture) return Response.json({ error: 'Fixture not found' }, { status: 404 })

  try {
    // 2. Delete results (should cascade to match_stats if set up, or we can be explicit)
    // To be safe, we'll manually delete match_stats first if they are linked via results
    const { data: resultData } = await db.from('results').select('id').eq('fixture_id', fixture_id).maybeSingle()
    if (resultData) {
      await db.from('match_stats').delete().eq('result_id', resultData.id)
      await db.from('results').delete().eq('id', resultData.id)
    }

    // 3. Delete confirmations
    await db.from('result_confirmations').delete().eq('fixture_id', fixture_id)

    // 4. Update fixture status
    await db.from('fixtures').update({ status: 'scheduled' }).eq('id', fixture_id)

    // 5. Recalculate standings for the tournament
    const recalcResult = await recalculateStandings(fixture.tournament_id)

    // 6. Audit log
    await db.from('audit_log').insert({
      admin_id: user.id,
      action: 'reset_fixture',
      target_type: 'fixture',
      target_id: fixture_id,
      details: {
        tournament_id: fixture.tournament_id,
        previous_status: fixture.status,
        recalc_result: recalcResult
      },
    })

    return Response.json({ success: true, recalc: recalcResult })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
