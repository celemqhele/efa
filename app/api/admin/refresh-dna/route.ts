// Requires: ALTER TABLE teams ADD COLUMN IF NOT EXISTS dna_profiles jsonb DEFAULT '[]'::jsonb;
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getTeamDNA, buildTeamStatsMixed } from '@/lib/dna-engine'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const adminSupabase = await createAdminClient()

  const { data: teams } = await adminSupabase.from('teams').select('id')
  if (!teams?.length) return Response.json({ updated: 0 })

  let updated = 0

  for (const team of teams) {
    const teamId = team.id

    const { data: fixtures } = await adminSupabase
      .from('fixtures')
      .select('id, home_team_id')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('status', 'confirmed')
      .order('scheduled_date', { ascending: false })
      .limit(5)

    if (!fixtures?.length) {
      await (adminSupabase as any).from('teams').update({ dna_profiles: [] }).eq('id', teamId)
      continue
    }

    const { data: results } = await adminSupabase
      .from('results')
      .select('id, fixture_id, home_score, away_score')
      .in('fixture_id', fixtures.map((f: any) => f.id))

    if (!results?.length) {
      await (adminSupabase as any).from('teams').update({ dna_profiles: [] }).eq('id', teamId)
      continue
    }

    const resultIds = results.map((r: any) => r.id)
    const { data: statsList } = await adminSupabase
      .from('match_stats')
      .select('*')
      .in('result_id', resultIds)

    const resultMap: Record<string, any> = {}
    for (const r of results) resultMap[r.id] = r

    const games = (statsList ?? []).flatMap((ms: any) => {
      const result = resultMap[ms.result_id]
      if (!result) return []
      const fixture = fixtures.find((f: any) => f.id === result.fixture_id)
      if (!fixture) return []
      const isHome = (fixture as any).home_team_id === teamId
      return [{ stats: ms, isHome, goalsAgainst: isHome ? result.away_score : result.home_score }]
    })

    const dna = games.length >= 1 ? getTeamDNA(buildTeamStatsMixed(games)) : []
    const { error: updateError } = await (adminSupabase as any)
      .from('teams')
      .update({ dna_profiles: dna })
      .eq('id', teamId)

    if (!updateError && dna.length > 0) updated++
  }

  return Response.json({ updated })
}
