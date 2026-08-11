import { createAdminClient } from '@/lib/supabase/server'
import { buildLiveStandings, goalDifference } from '@/lib/standings-core'

const ROUND_LABELS: Record<string, string> = {
  league: 'League Match',
  group: 'Group Stage',
  qf: 'Quarter-Final',
  sf: 'Semi-Final',
  final: 'Final',
  super_cup: 'Super Cup',
}

async function getDbDateKey(supabase: any): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_db_now')
    if (!error && data) return new Date(data).toISOString().slice(0, 10)
  } catch {}
  try {
    const { data: recent } = await supabase
      .from('fixtures')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recent?.created_at) return new Date(recent.created_at).toISOString().slice(0, 10)
  } catch {}
  return new Date().toISOString().slice(0, 10)
}

function formatStandingsRows(rows: any[]): string[] {
  return rows.map((row: any, i: number) => {
    const name = row.team?.name || 'Unknown Team'
    const gd = goalDifference(row)
    const gdStr = gd >= 0 ? `+${gd}` : `${gd}`
    return `    ${i + 1}. ${name} | P ${row.played ?? 0} | W ${row.wins ?? 0} | D ${row.draws ?? 0} | L ${row.losses ?? 0} | GF ${row.goals_for ?? 0} | GA ${row.goals_against ?? 0} | GD ${gdStr} | Pts ${row.points ?? 0}${row.absent ? ` | Abs ${row.absent}` : ''}`
  })
}

async function getH2HRecord(
  supabase: any,
  homeTeamId: string | undefined,
  awayTeamId: string | undefined,
  homeName: string | undefined,
  awayName: string | undefined,
): Promise<string | null> {
  if (!homeTeamId || !awayTeamId || !homeName || !awayName) return null
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('home_team_id, away_team_id, result:results(home_score, away_score)')
    .or(
      `and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`
    )
    .not('status', 'eq', 'scheduled')
    .order('created_at', { ascending: false })

  const played = (fixtures ?? []).filter(
    (f: any) => f.result && f.result.home_score != null && f.result.away_score != null
  )
  if (played.length === 0) return null

  let homeWins = 0
  let awayWins = 0
  let draws = 0
  let homeGoals = 0
  let awayGoals = 0
  for (const f of played) {
    const hs = Number(f.result.home_score)
    const as = Number(f.result.away_score)
    if (f.home_team_id === homeTeamId) {
      homeGoals += hs
      awayGoals += as
      if (hs > as) homeWins++
      else if (hs < as) awayWins++
      else draws++
    } else {
      homeGoals += as
      awayGoals += hs
      if (as > hs) homeWins++
      else if (as < hs) awayWins++
      else draws++
    }
  }
  return `${played.length} meetings | ${homeName} ${homeWins}W - ${draws}D - ${awayName} ${awayWins}W | Goals ${homeGoals}-${awayGoals}`
}

export async function GET() {
  const supabase = await createAdminClient()

  const todayKey = await getDbDateKey(supabase)
  const todayDate = new Date(todayKey + 'T00:00:00.000Z')
  const yesterdayDate = new Date(todayDate.getTime() - 86400000)
  const yesterdayKey = yesterdayDate.toISOString().slice(0, 10)

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type')
    .eq('status', 'active')
    .order('name')

  if (!tournaments?.length) {
    return new Response('No active tournaments found.', { status: 404 })
  }

  const lines: string[] = []
  lines.push(`=== EFA NEWS EXPORT ===`)
  lines.push(`DB date: ${todayKey}  |  Range: ${yesterdayKey} (yesterday) – ${todayKey} (today)`)
  lines.push('')

  for (const tournament of tournaments as any[]) {
    lines.push(`─── ${tournament.name} (${tournament.type.toUpperCase()}) ───`)
    lines.push('')

    // Results from today and yesterday (scheduled_date is a date column)
    const { data: results } = await supabase
      .from('fixtures')
      .select(`
        matchday, round_type, leg, scheduled_date,
        home_team:teams!fixtures_home_team_id_fkey(id, name),
        away_team:teams!fixtures_away_team_id_fkey(id, name),
        result:results(*)
      `)
      .eq('tournament_id', tournament.id)
      .eq('status', 'confirmed')
      .in('scheduled_date', [yesterdayKey, todayKey])
      .order('scheduled_date')

    if (results?.length) {
      lines.push('  RESULTS (Today & Yesterday):')
      for (const fx of results as any[]) {
        const res = fx.result
        const score = res ? `${res.home_score}–${res.away_score}` : 'N/A'
        const date = fx.scheduled_date ?? 'TBC'
        const round = ROUND_LABELS[fx.round_type] || fx.round_type || 'Match'
        lines.push(
          `    MD${fx.matchday} | ${date} | ${fx.home_team?.name} ${score} ${fx.away_team?.name} | ${round}${fx.leg && fx.leg > 1 ? ` Leg ${fx.leg}` : ''}`
        )
      }
    } else {
      lines.push('  RESULTS: None in this period.')
    }
    lines.push('')

    // Fixtures happening today
    const { data: todayFixtures } = await supabase
      .from('fixtures')
      .select(`
        matchday, round_type, leg, scheduled_date,
        home_team:teams!fixtures_home_team_id_fkey(id, name),
        away_team:teams!fixtures_away_team_id_fkey(id, name)
      `)
      .eq('tournament_id', tournament.id)
      .in('status', ['scheduled', 'awaiting_confirmation'])
      .eq('scheduled_date', todayKey)
      .order('scheduled_date')

    if (todayFixtures?.length) {
      lines.push('  FIXTURES TODAY:')
      for (const fx of todayFixtures as any[]) {
        const time = fx.scheduled_date
          ? new Date(fx.scheduled_date + 'T12:00:00Z').toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })
          : 'TBC'
        const round = ROUND_LABELS[fx.round_type] || fx.round_type || 'Match'
        lines.push(
          `    MD${fx.matchday} | ${todayKey} ${time} | ${fx.home_team?.name} vs ${fx.away_team?.name} | ${round}${fx.leg && fx.leg > 1 ? ` Leg ${fx.leg}` : ''}`
        )
        const h2h = await getH2HRecord(supabase, fx.home_team?.id, fx.away_team?.id, fx.home_team?.name, fx.away_team?.name)
        if (h2h) lines.push(`      H2H: ${h2h}`)
      }
    } else {
      lines.push('  FIXTURES TODAY: None.')
    }

    // Recently generated fixtures (created today via knockout generator etc.)
    const { data: recentFixtures } = await supabase
      .from('fixtures')
      .select(`
        matchday, round_type, leg, scheduled_date,
        home_team:teams!fixtures_home_team_id_fkey(id, name),
        away_team:teams!fixtures_away_team_id_fkey(id, name)
      `)
      .eq('tournament_id', tournament.id)
      .in('status', ['scheduled', 'awaiting_confirmation'])
      .gte('created_at', todayKey + 'T00:00:00.000Z')
      .lte('created_at', todayKey + 'T23:59:59.999Z')
      .neq('scheduled_date', todayKey)
      .order('created_at', { ascending: false })

    if (recentFixtures?.length) {
      lines.push('  RECENTLY GENERATED FIXTURES:')
      for (const fx of recentFixtures as any[]) {
        const date = fx.scheduled_date ?? 'TBC'
        const round = ROUND_LABELS[fx.round_type] || fx.round_type || 'Match'
        lines.push(
          `    MD${fx.matchday} | Scheduled: ${date} | ${fx.home_team?.name} vs ${fx.away_team?.name} | ${round}${fx.leg && fx.leg > 1 ? ` Leg ${fx.leg}` : ''}`
        )
        const h2h = await getH2HRecord(supabase, fx.home_team?.id, fx.away_team?.id, fx.home_team?.name, fx.away_team?.name)
        if (h2h) lines.push(`      H2H: ${h2h}`)
      }
    }

    // Standings
    const standingsResult = await buildLiveStandings(supabase, tournament.id, tournament.type)
    if (standingsResult.leagueStandings.length > 0) {
      lines.push('  STANDINGS:')
      lines.push(...formatStandingsRows(standingsResult.leagueStandings))
    } else if (Object.keys(standingsResult.groupStandings).length > 0) {
      for (const groupName of Object.keys(standingsResult.groupStandings).sort()) {
        lines.push(`  STANDINGS (GROUP ${groupName}):`)
        lines.push(...formatStandingsRows(standingsResult.groupStandings[groupName]))
      }
    } else {
      lines.push('  STANDINGS: None.')
    }
    lines.push('')
  }

  // AI prompt
  lines.push('─── AI NEWS ANALYSIS PROMPT ───')
  lines.push(
    `Analyze the data above from all tournaments. Identify the MOST INTERESTING news stories. ` +
    `Look for: 1) Shock results where favourites lost. 2) High-scoring matches. ` +
    `3) Teams on winning/losing streaks. 4) Critical six-pointers in the standings. ` +
    `5) Key upcoming fixtures that could decide titles or relegation, referencing the teams' standings and head-to-head (H2H) records. ` +
    `List 5 catchy headlines with a 2-sentence summary for each. Focus on drama and impact.`
  )

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="EFA_News_Export_${todayKey}.txt"`,
    },
  })
}
