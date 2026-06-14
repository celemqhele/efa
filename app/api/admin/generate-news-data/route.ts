import { createAdminClient } from '@/lib/supabase/server'

const ROUND_LABELS: Record<string, string> = {
  league: 'League Match',
  group: 'Group Stage',
  qf: 'Quarter-Final',
  sf: 'Semi-Final',
  final: 'Final',
  super_cup: 'Super Cup',
}

export async function GET() {
  const supabase = await createAdminClient()

  // 1. Get database time (approximate via most recent audit log entry)
  const { data: latestEntry } = await supabase
    .from('audit_log')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const dbNowIso = latestEntry?.created_at ?? new Date().toISOString()
  const todayKey = dbNowIso.slice(0, 10)

  // Compute yesterday
  const todayDate = new Date(todayKey + 'T00:00:00.000Z')
  const yesterdayDate = new Date(todayDate.getTime() - 86400000)
  const yesterdayKey = yesterdayDate.toISOString().slice(0, 10)

  // 2. Fetch all active tournaments
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
  lines.push(`Generated from DB time: ${dbNowIso}`)
  lines.push(`Date range: ${yesterdayKey} (yesterday) – ${todayKey} (today)`)
  lines.push('')

  for (const tournament of tournaments as any[]) {
    lines.push(`─── ${tournament.name} (${tournament.type.toUpperCase()}) ───`)
    lines.push('')

    // Results from today and yesterday
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
      .gte('scheduled_date', yesterdayKey)
      .lte('scheduled_date', todayKey + 'T23:59:59.999Z')
      .order('scheduled_date')

    if (results?.length) {
      lines.push('  RESULTS (Today & Yesterday):')
      for (const fx of results as any[]) {
        const res = fx.result
        const score = res ? `${res.home_score}–${res.away_score}` : 'N/A'
        const date = fx.scheduled_date ? String(fx.scheduled_date).slice(0, 10) : 'TBC'
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
    const { data: upcoming } = await supabase
      .from('fixtures')
      .select(`
        matchday, round_type, leg, scheduled_date,
        home_team:teams!fixtures_home_team_id_fkey(id, name),
        away_team:teams!fixtures_away_team_id_fkey(id, name)
      `)
      .eq('tournament_id', tournament.id)
      .in('status', ['scheduled', 'awaiting_confirmation'])
      .gte('scheduled_date', todayKey)
      .lte('scheduled_date', todayKey + 'T23:59:59.999Z')
      .order('scheduled_date')

    if (upcoming?.length) {
      lines.push('  FIXTURES TODAY:')
      for (const fx of upcoming as any[]) {
        const time = fx.scheduled_date
          ? new Date(fx.scheduled_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })
          : 'TBC'
        const round = ROUND_LABELS[fx.round_type] || fx.round_type || 'Match'
        lines.push(
          `    MD${fx.matchday} | ${todayKey} ${time} | ${fx.home_team?.name} vs ${fx.away_team?.name} | ${round}${fx.leg && fx.leg > 1 ? ` Leg ${fx.leg}` : ''}`
        )
      }
    } else {
      lines.push('  FIXTURES TODAY: None.')
    }
    lines.push('')
  }

  // Append an AI prompt
  lines.push('─── AI NEWS ANALYSIS PROMPT ───')
  lines.push(
    `Analyze the data above from all tournaments. Identify the MOST INTERESTING news stories. ` +
    `Look for: 1) Shock results where favourites lost. 2) High-scoring matches. ` +
    `3) Teams on winning/losing streaks. 4) Critical six-pointers in the standings. ` +
    `5) Key upcoming fixtures that could decide titles or relegation. ` +
    `List 5 catchy headlines with a 2-sentence summary for each. Focus on drama and impact.`
  )

  const textContent = lines.join('\n')

  return new Response(textContent, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="EFA_News_Export_${todayKey}.txt"`,
    },
  })
}
