import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournament_id')
  const matchday = searchParams.get('matchday')

  if (!tournamentId || !matchday) {
    return Response.json({ error: 'tournament_id and matchday required' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const { data } = await supabase
    .from('fixtures')
    .select(`id, home_team_id, away_team_id, result:results(*)`)
    .eq('tournament_id', tournamentId)
    .eq('matchday', parseInt(matchday))
    .maybeSingle()

  if (!data) {
    return Response.json({ fixture: null, result: null })
  }

  const result = Array.isArray(data.result) ? data.result[0] : data.result

  return Response.json({ fixture: data, result: result ?? null })
}
