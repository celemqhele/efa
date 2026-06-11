import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const teamIdsParam = searchParams.get('teamIds')
  if (!teamIdsParam) {
    return Response.json({ balances: [] })
  }

  const teamIds = teamIdsParam.split(',').filter(Boolean)
  if (teamIds.length === 0) {
    return Response.json({ balances: [] })
  }

  const { data, error } = await supabase
    .from('forfeit_balances')
    .select('*, forfeiting_team:teams!forfeit_balances_forfeiting_team_id_fkey(name), opponent_team:teams!forfeit_balances_opponent_team_id_fkey(name)')
    .in('forfeiting_team_id', teamIds)
    .gt('remaining', 0)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ balances: data ?? [] })
}
