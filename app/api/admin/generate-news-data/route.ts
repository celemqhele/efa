import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournament_id = searchParams.get('tournament_id')
  if (!tournament_id) return Response.json({ error: 'tournament_id required' }, { status: 400 })

  const supabase = await createAdminClient()

  // 1. Fetch Tournament & Standings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('name, type')
    .eq('id', tournament_id)
    .single()

  if (!tournament) return Response.json({ error: 'Tournament not found' }, { status: 404 })

  // Use standings or group_standings depending on type
  const isLeague = tournament.type === 'league'
  const { data: standings } = await supabase
    .from(isLeague ? 'standings' : 'group_standings')
    .select('*, team:teams(id, name)')
    .eq('tournament_id', tournament_id)
    .order('points', { ascending: false }) as any

  if (!standings || standings.length === 0) {
    return Response.json({ error: 'No standings data found' }, { status: 404 })
  }

  // 2. Fetch Deep Data for each team
  const csvRows: string[][] = [
    ['TEAM', 'POS', 'P', 'W', 'D', 'L', 'PTS', 'FORM (Last 5)', 'LAST 3 RESULTS', 'MATCH 1 STATS', 'MATCH 2 STATS'],
  ]

  for (let i = 0; i < standings.length; i++) {
    const s = standings[i]
    const teamId = s.team_id
    const teamName = s.team?.name || 'Unknown'

    // Get last 3 confirmed fixtures
    const { data: last3Fx } = await supabase
      .from('fixtures')
      .select(`
        id, scheduled_date, home_team_id,
        home_team:teams!fixtures_home_team_id_fkey(name),
        away_team:teams!fixtures_away_team_id_fkey(name),
        result:results(*)
      `)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('status', 'confirmed')
      .order('scheduled_date', { ascending: false })
      .limit(3) as any

    const resultsSummary = (last3Fx ?? []).map((f: any) => {
      const res = f.result
      if (!res) return 'N/A'
      const isHome = f.home_team_id === teamId
      const myScore = isHome ? res.home_score : res.away_score
      const theirScore = isHome ? res.away_score : res.home_score
      const opp = isHome ? f.away_team?.name : f.home_team?.name
      return `${myScore}-${theirScore} vs ${opp}`
    }).join(' | ')

    // Get detailed stats for last 2 matches
    const statsDetails: string[] = []
    const fxIds = (last3Fx ?? []).slice(0, 2).map((f: any) => f.id)
    
    if (fxIds.length > 0) {
      const { data: resultsForStats } = await supabase
        .from('results')
        .select('id, fixture_id')
        .in('fixture_id', fxIds)

      const resIds = resultsForStats?.map((r: any) => r.id) ?? []
      if (resIds.length > 0) {
        const { data: matchStats } = await supabase
          .from('match_stats')
          .select('*')
          .in('result_id', resIds)

        for (const ms of matchStats ?? []) {
          const res = resultsForStats?.find(r => r.id === ms.result_id)
          const fx = last3Fx?.find(f => f.id === res?.fixture_id)
          if (!fx) continue

          const isHome = fx.home_team_id === teamId
          
          const pos = isHome ? ms.home_possession : ms.away_possession
          const shots = isHome ? ms.home_shots : ms.away_shots
          const target = isHome ? ms.home_shots_on_target : ms.away_shots_on_target
          const passes = isHome ? ms.home_passes : ms.away_passes
          
          statsDetails.push(`Match vs ${isHome ? fx.away_team?.name : fx.home_team?.name}: ${pos}% Poss, ${shots} Shots (${target} OT), ${passes} Passes`)
        }
      }
    }

    csvRows.push([
      teamName,
      (i + 1).toString(),
      s.played.toString(),
      s.wins.toString(),
      s.draws.toString(),
      s.losses.toString(),
      s.points.toString(),
      (s.form || '').slice(-5),
      resultsSummary,
      statsDetails[0] || 'N/A',
      statsDetails[1] || 'N/A',
    ])
  }

  // 3. Add AI Prompt Row
  csvRows.push([])
  csvRows.push(['--- AI NEWS ANALYSIS PROMPT ---'])
  csvRows.push([
    `Analyze the data from the ${tournament.name} above. Identify the MOST INTERESTING news stories. 
     Nuance is key: don't just list winners. Look for:
     1. Unbeaten runs that just ended (Shock losses).
     2. Teams consistently dominating possession/shots but losing (The "Unlucky" story).
     3. Massive climbers in the table over the last 3 matches.
     4. Goal droughts or high-scoring bursts for specific teams.
     5. Critical "Six-Pointer" results that changed the top/bottom of the table.
     List 5 catchy headlines with a 2-sentence summary for each. Focus on drama, tactical shifts, and significant impact on the title race or relegation.`
  ])

  // 4. Generate CSV String
  const csvContent = csvRows
    .map((row: string[]) => row.map((cell: string) => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="EFA_News_Export.csv"`,
    },
  })
}
