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

  // 3. Fetch all confirmed fixtures and results for the relevant time period
  const { data: allFixtures } = await db
    .from('fixtures')
    .select('id, home_team_id, away_team_id, scheduled_date, results(home_score, away_score, override_reason)')
    .eq('status', 'confirmed')

  if (!allFixtures) return { error: 'No fixtures found' }

  // 4. Clear existing stats
  if (managerId) {
    await (db.from('manager_tenures' as any)).delete().eq('manager_id', managerId)
  } else {
    await (db.from('manager_tenures' as any)).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  // 5. Aggregate and prepare tenures for batch insert
  const processedTenures = []
  const managerIds = Array.from(new Set(tenures.map(t => t.manager_id)))
  const { data: profiles } = await db.from('profiles').select('id, username').in('id', managerIds)
  const usernameMap = new Map(profiles?.map(p => [p.id, p.username]) || [])

  for (const tenure of tenures) {
    if (managerId && tenure.manager_id !== managerId) continue

    let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0
    const start = new Date(tenure.started_at).getTime()
    const end = tenure.ended_at ? new Date(tenure.ended_at).getTime() : Infinity

    // Filter fixtures that belong to this team during this tenure
    const relevantFixtures = allFixtures.filter(f => {
      if (!f.scheduled_date) return false
      const fDate = new Date(f.scheduled_date).getTime()
      return (f.home_team_id === tenure.team_id || f.away_team_id === tenure.team_id) && 
             fDate >= start && fDate <= end
    })

    for (const f of relevantFixtures) {
      const res = Array.isArray(f.results) ? f.results[0] : f.results
      if (!res) continue

      const isHome = f.home_team_id === tenure.team_id
      const myScore = isHome ? res.home_score : res.away_score
      const theirScore = isHome ? res.away_score : res.home_score
      
      gf += myScore
      ga += theirScore

      if (myScore > theirScore) wins++
      else if (myScore === theirScore) draws++
      else losses++
    }

    processedTenures.push({ 
      ...tenure, 
      manager_username: usernameMap.get(tenure.manager_id) || 'Unknown',
      wins, draws, losses, goals_for: gf, goals_against: ga 
    })
  }

  // Batch insert tenures
  if (processedTenures.length > 0) {
    await (db.from('manager_tenures' as any)).insert(processedTenures)
  }

  return { success: true, tenuresProcessed: processedTenures.length }
}
