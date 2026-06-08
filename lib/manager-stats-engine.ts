import { createAdminClient } from '@/lib/supabase/server'

export async function recalculateManagerStats(managerId?: string) {
  const db = await createAdminClient()

  // 1. Fetch Audit Logs
  const { data: logs } = await db
    .from('audit_log')
    .select('*')
    .or('action.ilike.%manager%,action.ilike.%claim%')
    .order('created_at', { ascending: true })

  if (!logs) return { error: 'No audit logs found' }

  // 2. Build Tenures Timeline
  const tenures: any[] = []
  const currentTenures: Record<string, any> = {}

  for (const log of logs) {
    const teamId = log.target_id
    if (!teamId) continue

    if (log.action === 'assign_manager' || log.action === 'claim_team') {
      const details = log.details as any
      const userId = details?.assigned_user_id || details?.user_id
      if (!userId) continue
      
      // End existing
      if (currentTenures[teamId]) {
        currentTenures[teamId].ended_at = log.created_at
        tenures.push(currentTenures[teamId])
      }
      currentTenures[teamId] = { manager_id: userId, team_id: teamId, started_at: log.created_at, ended_at: null }
    } else if (log.action === 'sack_manager' || log.action === 'auto_sack_manager') {
      if (currentTenures[teamId]) {
        currentTenures[teamId].ended_at = log.created_at
        tenures.push(currentTenures[teamId])
        delete currentTenures[teamId]
      }
    }
  }
  
  // Add active tenures
  for (const t of Object.values(currentTenures)) tenures.push(t)

  // 3. Clear existing stats
  if (managerId) {
    await (db.from('manager_tenures' as any)).delete().eq('manager_id', managerId)
  } else {
    await (db.from('manager_tenures' as any)).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  // 4. Aggregate and insert
  for (const tenure of tenures) {
    if (managerId && tenure.manager_id !== managerId) continue

    const { data: fixtures } = await db
      .from('fixtures')
      .select('id, home_team_id, away_team_id, results(home_score, away_score)')
      .or(`home_team_id.eq.${tenure.team_id},away_team_id.eq.${tenure.team_id}`)
      .gte('scheduled_date', tenure.started_at)
      .lte('scheduled_date', tenure.ended_at || new Date().toISOString())
      .eq('status', 'confirmed')

    let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0

    for (const f of fixtures || []) {
      const res = Array.isArray(f.results) ? f.results[0] : f.results
      if (!res) continue

      const isHome = f.home_team_id === tenure.team_id
      gf += isHome ? res.home_score : res.away_score
      ga += isHome ? res.away_score : res.home_score
      
      if (res.home_score === res.away_score) draws++
      else if (isHome ? res.home_score > res.away_score : res.away_score > res.home_score) wins++
      else losses++
    }

    await (db.from('manager_tenures' as any)).insert({ ...tenure, wins, draws, losses, goals_for: gf, goals_against: ga })
  }

  return { success: true, tenuresProcessed: tenures.length }
}
