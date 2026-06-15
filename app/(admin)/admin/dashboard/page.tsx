export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { getAppTodayKey, getAppDayUtcRange } from '@/lib/app-time'
import Shell from './_shell'

export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createAdminClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status, season_id')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const tournamentIds = ((tournaments ?? []) as any[]).map((t) => t.id)
  const { data: fixtureCounts } = tournamentIds.length
    ? await supabase
        .from('fixtures')
        .select('tournament_id')
        .in('tournament_id', tournamentIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const f of (fixtureCounts ?? []) as any[]) {
    countMap[f.tournament_id] = (countMap[f.tournament_id] ?? 0) + 1
  }

  const todayKey = await getAppTodayKey(supabase)
  const { endIso: todayEnd } = getAppDayUtcRange(todayKey)

  const { data: dueFixtures } = await (supabase as any)
    .from('fixtures')
    .select(`
      id, matchday, status, scheduled_date,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager:profiles!teams_manager_id_fkey(id, username, whatsapp_number)),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager:profiles!teams_manager_id_fkey(id, username, whatsapp_number))
    `)
    .in('status', ['scheduled', 'awaiting_confirmation'])
    .lte('scheduled_date', todayEnd)
    .order('scheduled_date', { ascending: true })

  const { data: allConfirmations } = await supabase
    .from('result_confirmations')
    .select('fixture_id, home_score, away_score, submitted_by')

  const conflictMap: Record<string, any[]> = {}
  for (const c of (allConfirmations ?? []) as any[]) {
    if (!conflictMap[c.fixture_id]) conflictMap[c.fixture_id] = []
    conflictMap[c.fixture_id]!.push(c)
  }

  const conflictFixtureIds = Object.entries(conflictMap)
    .filter(([, confs]) => {
      if ((confs?.length ?? 0) < 2) return false
      const first = confs![0]
      return confs!.some((c) => c.home_score !== first!.home_score || c.away_score !== first!.away_score)
    })
    .map(([id]) => id)

  const { data: conflictFixtures } = conflictFixtureIds.length
    ? await supabase
        .from('fixtures')
        .select(`
          id, matchday, status,
          home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug)
        `)
        .in('id', conflictFixtureIds)
    : { data: [] }

  const { data: pendingConfirmations } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug)
    `)
    .eq('status', 'awaiting_confirmation')
    .order('scheduled_date', { ascending: true })
    .limit(10)

  const { data: changeRequests } = await supabase
    .from('team_change_requests')
    .select(`
      id, status, created_at,
      requesting_user:profiles!team_change_requests_requesting_user_id_fkey(id, username, avatar_url),
      requested_team:teams!team_change_requests_requested_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      current_team:teams!team_change_requests_current_team_id_fkey(id, name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const { data: flaggedTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, abandon_count, manager_id')
    .gte('abandon_count', 3)
    .order('abandon_count', { ascending: false })

  const managerIds = ((flaggedTeams ?? []) as any[]).filter((t: any) => t.manager_id).map((t: any) => t.manager_id!)
  const { data: flaggedManagers } = managerIds.length
    ? await supabase.from('profiles').select('id, username').in('id', managerIds)
    : { data: [] }
  const managerMap: Record<string, string> = {}
  for (const m of (flaggedManagers ?? []) as any[]) managerMap[m.id] = m.username

  const { data: auditLog } = await supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, details, created_at, admin:profiles!audit_log_admin_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <Shell data={{
      tournaments: (tournaments ?? []) as any[],
      countMap,
      dueFixtures: (dueFixtures ?? []) as any[],
      dueCount: dueFixtures?.length ?? 0,
      conflictFixtures: (conflictFixtures ?? []) as any[],
      conflictCount: conflictFixtures?.length ?? 0,
      conflictMap,
      pendingConfirmations: (pendingConfirmations ?? []) as any[],
      pendingCount: pendingConfirmations?.length ?? 0,
      changeRequests: (changeRequests ?? []) as any[],
      requestCount: changeRequests?.length ?? 0,
      flaggedTeams: (flaggedTeams ?? []) as any[],
      flaggedCount: flaggedTeams?.length ?? 0,
      managerMap,
      auditLog: (auditLog ?? []) as any[],
    }} />
  )
}
