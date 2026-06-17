export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { getAppTodayKey, getAppDayUtcRange } from '@/lib/app-time'
import Shell from './_shell'

export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createAdminClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select(`
      id, name, type, status, created_at,
      season:seasons!tournaments_season_id_fkey(id, name, status)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const tournamentIds = ((tournaments ?? []) as any[]).map((t) => t.id)

  const { data: participants } = tournamentIds.length
    ? await supabase
        .from('tournament_participants')
        .select('tournament_id')
        .in('tournament_id', tournamentIds)
    : { data: [] }
  const participantCounts: Record<string, number> = {}
  for (const p of (participants ?? []) as any[]) {
    participantCounts[p.tournament_id] = (participantCounts[p.tournament_id] ?? 0) + 1
  }

  const { data: fixtures } = tournamentIds.length
    ? await supabase
        .from('fixtures')
        .select('tournament_id, status')
        .in('tournament_id', tournamentIds)
    : { data: [] }
  const fixtureCounts: Record<string, number> = {}
  const completedCounts: Record<string, number> = {}
  for (const f of (fixtures ?? []) as any[]) {
    fixtureCounts[f.tournament_id] = (fixtureCounts[f.tournament_id] ?? 0) + 1
    if (f.status === 'confirmed') {
      completedCounts[f.tournament_id] = (completedCounts[f.tournament_id] ?? 0) + 1
    }
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

  const { data: auditLog } = await supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, details, created_at, admin:profiles!audit_log_admin_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <Shell data={{
      tournaments: (tournaments ?? []) as any[],
      participantCounts,
      fixtureCounts,
      completedCounts,
      dueFixtures: (dueFixtures ?? []) as any[],
      dueCount: dueFixtures?.length ?? 0,
      conflictFixtures: (conflictFixtures ?? []) as any[],
      conflictCount: conflictFixtures?.length ?? 0,
      conflictMap,
      auditLog: (auditLog ?? []) as any[],
    }} />
  )
}
