import { createAdminClient } from '@/lib/supabase/server'

export async function recalculateManagerStats(managerId?: string) {
  const db = await createAdminClient()

  let query = db.from('manager_tenures' as any).select('*')
  if (managerId) {
    query = query.eq('manager_id', managerId)
  }
  const { data: tenures } = await query as any

  if (!tenures || tenures.length === 0) {
    return { success: true, tenuresProcessed: 0 }
  }

  const VALID_STATUSES = ['confirmed', 'abandoned_home', 'abandoned_away', 'abandoned_both']

  let processedCount = 0

  for (const tenure of tenures) {
    const { id: tenureId, team_id, started_at, ended_at } = tenure

    let statsQuery = db
      .from('fixtures')
      .select('id, home_team_id, away_team_id, results(home_score, away_score)')
      .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
      .gte('scheduled_date', started_at)
      .in('status', VALID_STATUSES)

    if (ended_at) {
      statsQuery = statsQuery.lte('scheduled_date', ended_at)
    }

    const { data: fixtures } = await statsQuery

    let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0

    for (const f of (fixtures ?? []) as any[]) {
      const res = Array.isArray(f.results) ? f.results[0] : f.results
      if (!res) continue

      const isHome = f.home_team_id === team_id
      const myScore = isHome ? res.home_score : res.away_score
      const theirScore = isHome ? res.away_score : res.home_score

      gf += myScore
      ga += theirScore

      if (myScore > theirScore) wins++
      else if (myScore === theirScore) draws++
      else losses++
    }

    await db
      .from('manager_tenures' as any)
      .update({ wins, draws, losses, goals_for: gf, goals_against: ga })
      .eq('id', tenureId)

    processedCount++
  }

  return { success: true, tenuresProcessed: processedCount }
}
