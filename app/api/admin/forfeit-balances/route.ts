import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const managerIdsParam = searchParams.get('managerIds')
  if (!managerIdsParam) {
    return Response.json({ balances: [] })
  }

  const managerIds = managerIdsParam.split(',').filter(Boolean)
  if (managerIds.length === 0) {
    return Response.json({ balances: [] })
  }

  const { data, error } = await supabase
    .from('forfeit_balances')
    .select('*, forfeiting_manager:profiles!forfeit_balances_forfeiting_manager_id_fkey(username), opponent_team:teams!forfeit_balances_opponent_team_id_fkey(name)')
    .in('forfeiting_manager_id', managerIds)
    .gt('remaining', 0)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ balances: data ?? [] })
}
