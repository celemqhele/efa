import { createAdminClient } from '@/lib/supabase/server'

async function migrateManagerStats() {
  const db = await createAdminClient()

  // 1. Fetch Audit Logs
  const { data: logs } = await db
    .from('audit_log')
    .select('*')
    .or('action.ilike.%manager%,action.ilike.%claim%')
    .order('created_at', { ascending: true })

  if (!logs) return

  // 2. Build Tenures Timeline
  const currentTenures: Record<string, any> = {}
  const completedTenures: any[] = []

  for (const log of logs) {
    const teamId = log.target_id
    if (!teamId) continue

    if (log.action === 'assign_manager' || log.action === 'claim_team') {
      const userId = log.details?.assigned_user_id || log.details?.user_id
      if (!userId) continue
      if (currentTenures[teamId]) {
        currentTenures[teamId].ended_at = log.created_at
        completedTenures.push(currentTenures[teamId])
      }
      currentTenures[teamId] = { manager_id: userId, team_id: teamId, started_at: log.created_at, ended_at: null }
    } else if (log.action === 'sack_manager' || log.action === 'auto_sack_manager') {
      if (currentTenures[teamId]) {
        currentTenures[teamId].ended_at = log.created_at
        completedTenures.push(currentTenures[teamId])
        delete currentTenures[teamId]
      }
    }
  }

  // 3. Aggregate Stats and Update Tenures
  for (const tenure of [...completedTenures, ...Object.values(currentTenures)]) {
    // Correctly filter fixtures for the team
    const { data: fixtures } = await db
      .from('fixtures')
      .select('id, home_team_id, away_team_id, results(home_score, away_score, override_reason)')
      .or(`home_team_id.eq.${tenure.team_id},away_team_id.eq.${tenure.team_id}`)
      .gte('scheduled_date', tenure.started_at)
      .lte('scheduled_date', tenure.ended_at || new Date().toISOString())
      .eq('status', 'confirmed')

    let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0

    for (const f of fixtures || []) {
      const res = Array.isArray(f.results) ? f.results[0] : f.results
      if (!res) continue

      const isHome = f.home_team_id === tenure.team_id
      const scoreFor = isHome ? res.home_score : res.away_score
      const scoreAgainst = isHome ? res.away_score : res.home_score
      
      gf += scoreFor
      ga += scoreAgainst

      if (res.home_score === res.away_score) draws++
      else if (isHome ? res.home_score > res.away_score : res.away_score > res.home_score) wins++
      else losses++
    }

    await db.from('manager_tenures').upsert({
      ...tenure,
      wins, draws, losses, goals_for: gf, goals_against: ga
    }, { onConflict: 'manager_id,team_id,started_at' })
  }

  console.log('Migration completed.')
}

migrateManagerStats().catch(console.error)
