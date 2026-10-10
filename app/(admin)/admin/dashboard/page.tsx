export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { getAppTodayKey, getAppDayUtcRange } from '@/lib/app-time'
import Shell from './_shell'
import { KO_ROUNDS } from '@/lib/tournament-rounds'

export const revalidate = 0

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 'YYYY-MM-DD' → 'Fri 17 Oct' for the reminder's postponement line.
function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return dateKey
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`
}

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
        .select('tournament_id, status, round_type')
        .in('tournament_id', tournamentIds)
    : { data: [] }
  const fixtureCounts: Record<string, number> = {}
  const completedCounts: Record<string, number> = {}
  const koCounts: Record<string, number> = {}
  for (const f of (fixtures ?? []) as any[]) {
    fixtureCounts[f.tournament_id] = (fixtureCounts[f.tournament_id] ?? 0) + 1
    if (f.status === 'confirmed' && !f.postponed_confirmed) {
      completedCounts[f.tournament_id] = (completedCounts[f.tournament_id] ?? 0) + 1
    }
    if (KO_ROUNDS.includes(f.round_type)) {
      koCounts[f.tournament_id] = (koCounts[f.tournament_id] ?? 0) + 1
    }
  }

  const todayKey = await getAppTodayKey(supabase)
  const { endIso: todayEnd } = getAppDayUtcRange(todayKey)

  // Due = still to play (scheduled / awaiting confirmation), plus
  // postponed-confirmed fixtures on their moved date — those carry
  // status='confirmed' + postponed_confirmed=true but the game itself is still
  // to be played, so they must stay visible here.
  const { data: dueFixtures } = await (supabase as any)
    .from('fixtures')
    .select(`
      id, matchday, status, scheduled_date, postponed_confirmed,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager:profiles!teams_manager_id_fkey(id, username, phone)),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager:profiles!teams_manager_id_fkey(id, username, phone))
    `)
    .or('status.in.(scheduled,awaiting_confirmation),and(status.eq.confirmed,postponed_confirmed.eq.true)')
    .lte('scheduled_date', todayEnd)
    .order('scheduled_date', { ascending: true })

  // Pending postponement requests + live backdoor reports on the due fixtures,
  // so each reminder can acknowledge a postponement / "not responding" report
  // instead of reading like nothing happened. Annotated onto the fixture rows.
  const dueIds = ((dueFixtures ?? []) as any[]).map((f) => f.id)
  const { data: pendingPostpones } = dueIds.length
    ? await supabase
        .from('postpone_requests')
        .select('fixture_id, requested_by, new_date')
        .eq('status', 'pending')
        .in('fixture_id', dueIds)
    : { data: [] }
  const { data: liveBackdoors } = dueIds.length
    ? await supabase
        .from('backdoor_submissions')
        .select('fixture_id, side_claimed, screenshot_url')
        .eq('status', 'pending')
        .in('fixture_id', dueIds)
    : { data: [] }

  const postponeMap = new Map<string, any>()
  for (const p of (pendingPostpones ?? []) as any[]) postponeMap.set(p.fixture_id, p)
  const backdoorMap = new Map<string, any[]>()
  for (const b of (liveBackdoors ?? []) as any[]) {
    const list = backdoorMap.get(b.fixture_id) ?? []
    list.push(b)
    backdoorMap.set(b.fixture_id, list)
  }

  for (const fx of (dueFixtures ?? []) as any[]) {
    const homeManagerId = fx.home_team?.manager?.id ?? null
    const postpone = postponeMap.get(fx.id)
    fx._postpone = postpone
      ? {
          requesterSide: homeManagerId && postpone.requested_by === homeManagerId ? 'home' : 'away',
          newDateLabel: postpone.new_date ? formatDateLabel(String(postpone.new_date).slice(0, 10)) : null,
        }
      : null
    fx._backdoors = (backdoorMap.get(fx.id) ?? []).map((b: any) => ({
      reportedSide: b.side_claimed === 'home' ? 'home' : 'away',
      screenshotUrl: b.screenshot_url ?? null,
    }))
  }

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
      koCounts,
      dueFixtures: (dueFixtures ?? []) as any[],
      dueCount: dueFixtures?.length ?? 0,
      conflictFixtures: (conflictFixtures ?? []) as any[],
      conflictCount: conflictFixtures?.length ?? 0,
      conflictMap,
      auditLog: (auditLog ?? []) as any[],
    }} />
  )
}
