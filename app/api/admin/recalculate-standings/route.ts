import { createClient, createAdminClient } from '@/lib/supabase/server'
import { recalculateStandings } from '@/lib/standings-engine'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { tournament_id: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tournament_id } = body
  if (!tournament_id) return Response.json({ error: 'tournament_id required' }, { status: 400 })

  try {
    const result = await recalculateStandings(tournament_id)

    const db = await createAdminClient()
    await db.from('audit_log').insert({
      admin_id: user.id,
      action: 'recalculate_standings',
      target_type: 'tournament',
      target_id: tournament_id,
      details: result,
    })

    return Response.json({
      success: true,
      ...result
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
