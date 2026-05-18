import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { drawUCLKnockout, drawEuropaKnockout } from './seeding-engine'
import { generateGroupFixtures } from './fixture-generator'
import { format, addDays } from 'date-fns'

export async function checkAndProgressUCL(
  supabase: SupabaseClient<Database>,
  tournamentId: string
) {
  // Check if all group fixtures are done
  const { data: groupFixtures } = await supabase
    .from('fixtures')
    .select('id, status')
    .eq('tournament_id', tournamentId)
    .eq('round_type', 'group')

  if (!groupFixtures) return
  const allDone = groupFixtures.every((f) => f.status === 'confirmed')
  if (!allDone) return

  // Get top 2 from each group
  const { data: groups } = await supabase
    .from('group_standings')
    .select('group_name, team_id, points, goal_difference, goals_for')
    .eq('tournament_id', tournamentId)
    .order('group_name')
    .order('points', { ascending: false })
    .order('goal_difference', { ascending: false })
    .order('goals_for', { ascending: false })

  if (!groups) return

  const groupMap: Record<string, Array<{ teamId: string; group: string }>> = {}
  for (const row of groups) {
    if (!groupMap[row.group_name]) groupMap[row.group_name] = []
    if (groupMap[row.group_name].length < 2) {
      groupMap[row.group_name].push({ teamId: row.team_id, group: row.group_name })
    }
  }

  const winners = Object.values(groupMap).map((g) => g[0])
  const runnersUp = Object.values(groupMap).map((g) => g[1])

  const draw = drawUCLKnockout(winners, runnersUp)

  // Create QF knockout rounds
  const today = format(new Date(), 'yyyy-MM-dd')
  const qfDate = format(addDays(new Date(), 3), 'yyyy-MM-dd')

  for (const match of draw.matches) {
    await supabase.from('fixtures').insert({
      tournament_id: tournamentId,
      home_team_id: match.home,
      away_team_id: match.away,
      matchday: 999,
      round_type: 'qf',
      leg: 1,
      scheduled_date: qfDate,
      deadline: `${qfDate}T12:00:00Z`,
    })
  }

  // Notify qualified teams
  const qualifiedTeams = [...winners, ...runnersUp].map((t) => t.teamId)
  const { data: managers } = await supabase
    .from('teams')
    .select('manager_id')
    .in('id', qualifiedTeams)

  for (const team of managers ?? []) {
    if (team.manager_id) {
      await supabase.from('notifications').insert({
        user_id: team.manager_id,
        type: 'qualification',
        title: 'UCL Quarter Finals',
        body: "You've qualified for the EFA Champions League Quarter Finals!",
        data: { tournament_id: tournamentId },
      })
    }
  }
}

export async function checkAndCreateSuperCup(supabase: SupabaseClient<Database>) {
  // Find UCL and Europa finals with results
  const { data: uclFinal } = await supabase
    .from('fixtures')
    .select('id, results(home_score, away_score, home_team_id, away_team_id), home_team_id, away_team_id')
    .eq('round_type', 'final')
    .not('tournament_id', 'is', null)
    .limit(1)
    .single()

  const { data: europaFinal } = await supabase
    .from('fixtures')
    .select('id, results(home_score, away_score), home_team_id, away_team_id, tournament_id')
    .eq('round_type', 'final')
    .not('tournament_id', 'is', null)
    .limit(1)
    .single()

  if (!uclFinal || !europaFinal) return

  const uclResult = Array.isArray(uclFinal.results) ? uclFinal.results[0] : uclFinal.results
  const europaResult = Array.isArray(europaFinal.results) ? europaFinal.results[0] : europaFinal.results

  if (!uclResult || !europaResult) return

  const uclWinner = (uclResult as { home_score: number; away_score: number }).home_score >
    (uclResult as { home_score: number; away_score: number }).away_score
    ? uclFinal.home_team_id
    : uclFinal.away_team_id

  const europaWinner = (europaResult as { home_score: number; away_score: number }).home_score >
    (europaResult as { home_score: number; away_score: number }).away_score
    ? europaFinal.home_team_id
    : europaFinal.away_team_id

  // Check if super cup already exists
  const { data: existing } = await supabase
    .from('fixtures')
    .select('id')
    .eq('round_type', 'super_cup')
    .limit(1)

  if (existing && existing.length > 0) return

  const superCupDate = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  // Create super cup tournament entry
  const { data: tournament } = await supabase
    .from('tournaments')
    .insert({
      name: 'EFA Super Cup',
      type: 'super_cup',
      status: 'active',
    })
    .select()
    .single()

  if (!tournament) return

  await supabase.from('fixtures').insert({
    tournament_id: tournament.id,
    home_team_id: uclWinner,
    away_team_id: europaWinner,
    matchday: 1,
    round_type: 'super_cup',
    leg: 1,
    scheduled_date: superCupDate,
    deadline: `${superCupDate}T12:00:00Z`,
  })

  // Notify all users
  const { data: allUsers } = await supabase.from('profiles').select('id')
  const { data: homeTeam } = await supabase.from('teams').select('name').eq('id', uclWinner).single()
  const { data: awayTeam } = await supabase.from('teams').select('name').eq('id', europaWinner).single()

  for (const user of allUsers ?? []) {
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'super_cup',
      title: 'EFA Super Cup',
      body: `EFA Super Cup: ${homeTeam?.name} vs ${awayTeam?.name} — ${superCupDate}`,
      data: { tournament_id: tournament.id },
    })
  }
}
