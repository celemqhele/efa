import { addDays, format, parseISO } from 'date-fns'

type KnockoutRound = 'qf' | 'sf' | 'final'

const BRACKET_PROGRESSION: Record<number, { nextMd: number; slot: 'home_team_id' | 'away_team_id' }> = {
  101: { nextMd: 201, slot: 'home_team_id' },
  102: { nextMd: 201, slot: 'away_team_id' },
  103: { nextMd: 202, slot: 'home_team_id' },
  104: { nextMd: 202, slot: 'away_team_id' },
  201: { nextMd: 301, slot: 'home_team_id' },
  202: { nextMd: 301, slot: 'away_team_id' },
}

function sortGroup(teams: any[]): any[] {
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = (a.goals_for ?? 0) - (a.goals_against ?? 0)
    const gdB = (b.goals_for ?? 0) - (b.goals_against ?? 0)
    if (gdB !== gdA) return gdB - gdA
    return (b.goals_for ?? 0) - (a.goals_for ?? 0)
  })
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function assignKnockoutDates(
  db: any,
  fixtures: Array<{ home_team_id: string | null; away_team_id: string | null }>,
  tournamentId: string
): Promise<string[]> {
  const { getSlotStateForDate, getDailyCapacity } = await import('./fixture-slots')

  // Get the last group fixture date to start knockouts after it
  const { data: lastGroupRow } = await db
    .from('fixtures')
    .select('scheduled_date')
    .eq('tournament_id', tournamentId)
    .eq('round_type', 'group')
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const afterDate: string = lastGroupRow?.scheduled_date
    ? String(lastGroupRow.scheduled_date).slice(0, 10)
    : format(new Date(), 'yyyy-MM-dd')

  const startDate = format(addDays(parseISO(afterDate), 1), 'yyyy-MM-dd')

  // Pre-compute slot state for startDate so we don't double-count
  const slotCache: Record<string, { globalUsed: number; teamUsed: Record<string, number> }> = {}
  const baseState = await getSlotStateForDate(db, startDate)
  slotCache[startDate] = { ...baseState }

  const dates: string[] = []

  for (const fx of fixtures) {
    let currentDate = parseISO(startDate)
    let assigned = false

    for (let safety = 0; safety < 730; safety++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')

      if (!slotCache[dateStr]) {
        const s = await getSlotStateForDate(db, dateStr)
        slotCache[dateStr] = { ...s }
      }

      const state = slotCache[dateStr]
      const { globalCap, teamCap } = getDailyCapacity(dateStr)

      // For TBC (null team), only check global capacity
      const homeOk = !fx.home_team_id || (state.teamUsed[fx.home_team_id] ?? 0) < teamCap
      const awayOk = !fx.away_team_id || (state.teamUsed[fx.away_team_id] ?? 0) < teamCap

      if (state.globalUsed + 2 <= globalCap && homeOk && awayOk) {
        dates.push(dateStr)
        state.globalUsed += 2
        if (fx.home_team_id) state.teamUsed[fx.home_team_id] = (state.teamUsed[fx.home_team_id] ?? 0) + 1
        if (fx.away_team_id) state.teamUsed[fx.away_team_id] = (state.teamUsed[fx.away_team_id] ?? 0) + 1
        assigned = true
        break
      }

      currentDate = addDays(currentDate, 1)
    }

    if (!assigned) {
      dates.push(format(addDays(parseISO(startDate), dates.length), 'yyyy-MM-dd'))
    }
  }

  return dates
}

export async function generateTBCKnockouts(
  db: any,
  tournamentId: string,
  shuffleTeams = false,
  manualQualifiers?: string[]
): Promise<{ error?: string }> {
  const { count: existingKO } = await db
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .in('round_type', ['qf', 'sf', 'final'])

  if ((existingKO ?? 0) > 0) return { error: 'Knockout fixtures already exist' }

  const { data: tournament } = await db
    .from('tournaments')
    .select('settings, type')
    .eq('id', tournamentId)
    .single()

  const settings = (tournament?.settings as any) || {}
  const qualifiersPerGroup = settings.qualifiers_per_group ?? 2
  const numGroups = settings.num_groups ?? 2

  let qualifiers: string[] = []

  if (manualQualifiers && manualQualifiers.length >= 2) {
    qualifiers = manualQualifiers
  } else {
    const { data: gs } = await db
      .from('group_standings')
      .select('team_id, group_name, points, goals_for, goals_against')
      .eq('tournament_id', tournamentId)

    if (!gs?.length) return { error: 'No group standings found' }

    const groups: Record<string, any[]> = {}
    gs.forEach((s: any) => {
      if (!groups[s.group_name]) groups[s.group_name] = []
      groups[s.group_name].push(s)
    })

    const sortedGroups = Object.keys(groups).sort().map(name => sortGroup(groups[name]))

    if (numGroups === 2 && qualifiersPerGroup === 2) {
      qualifiers.push(sortedGroups[0][0].team_id, sortedGroups[1][1].team_id, sortedGroups[1][0].team_id, sortedGroups[0][1].team_id)
    } else {
      for (let i = 0; i < qualifiersPerGroup; i++) {
        for (let j = 0; j < numGroups; j++) {
          if (sortedGroups[j] && sortedGroups[j][i]) {
            qualifiers.push(sortedGroups[j][i].team_id)
          }
        }
      }
    }
  }

  const teamCount = qualifiers.length
  if (teamCount < 2) return { error: 'Not enough teams to start knockouts' }

  const finalQualifiers = shuffleTeams ? shuffle(qualifiers) : qualifiers

  // Build fixture templates (without dates) to pass to slot assigner
  interface KOFixture { home_team_id: string | null; away_team_id: string | null; matchday: number; round_type: KnockoutRound }
  let koFixtures: KOFixture[] = []

  if (teamCount === 8) {
    koFixtures = [
      ...[0, 1, 2, 3].map(i => ({
        home_team_id: finalQualifiers[i * 2],
        away_team_id: finalQualifiers[i * 2 + 1],
        matchday: 101 + i,
        round_type: 'qf' as KnockoutRound,
      })),
      { home_team_id: null, away_team_id: null, matchday: 201, round_type: 'sf' as KnockoutRound },
      { home_team_id: null, away_team_id: null, matchday: 202, round_type: 'sf' as KnockoutRound },
      { home_team_id: null, away_team_id: null, matchday: 301, round_type: 'final' as KnockoutRound },
    ]
  } else if (teamCount === 4) {
    koFixtures = [
      { home_team_id: finalQualifiers[0], away_team_id: finalQualifiers[1], matchday: 201, round_type: 'sf' as KnockoutRound },
      { home_team_id: finalQualifiers[2], away_team_id: finalQualifiers[3], matchday: 202, round_type: 'sf' as KnockoutRound },
      { home_team_id: null, away_team_id: null, matchday: 301, round_type: 'final' as KnockoutRound },
    ]
  } else {
    koFixtures = [
      { home_team_id: finalQualifiers[0], away_team_id: finalQualifiers[1] ?? null, matchday: 301, round_type: 'final' as KnockoutRound },
    ]
  }

  const dates = await assignKnockoutDates(db, koFixtures, tournamentId)

  if (dates.length < koFixtures.length) {
    return { error: 'Could not find enough available dates for knockout fixtures' }
  }

  const insertFixtures = koFixtures.map((kf, i) => ({
    tournament_id: tournamentId,
    home_team_id: kf.home_team_id,
    away_team_id: kf.away_team_id,
    matchday: kf.matchday,
    scheduled_date: dates[i],
    deadline: `${dates[i]}T12:00:00Z`,
    round_type: kf.round_type,
    leg: 1,
    status: 'scheduled',
  }))

  const { error } = await db.from('fixtures').insert(insertFixtures)
  if (error) return { error: error.message }
  return {}
}

export async function advanceWinner(
  db: any,
  tournamentId: string,
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  homeTeamId: string | null,
  awayTeamId: string | null
): Promise<void> {
  const winnerId = homeScore > awayScore ? homeTeamId : awayScore > homeScore ? awayTeamId : null
  if (!winnerId) return

  const { data: curFx } = await db
    .from('fixtures')
    .select('matchday, round_type')
    .eq('id', fixtureId)
    .single()

  if (!curFx) return

  const progression = BRACKET_PROGRESSION[curFx.matchday]
  if (!progression) {
    if (curFx.round_type === 'final') {
      await awardTrophy(db, tournamentId, homeScore, awayScore, homeTeamId, awayTeamId)
    }
    return
  }

  const { data: nextFx } = await db
    .from('fixtures')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('matchday', progression.nextMd)
    .maybeSingle()

  if (nextFx) {
    await db
      .from('fixtures')
      .update({ [progression.slot]: winnerId })
      .eq('id', nextFx.id)
  }
}

/** @deprecated use advanceWinner */
export async function fillFinalSlot(
  db: any,
  tournamentId: string,
  sfFixtureId: string,
  homeScore: number,
  awayScore: number,
  homeTeamId: string | null,
  awayTeamId: string | null
): Promise<void> {
  return advanceWinner(db, tournamentId, sfFixtureId, homeScore, awayScore, homeTeamId, awayTeamId)
}

export async function awardTrophy(
  db: any,
  tournamentId: string,
  homeScore: number,
  awayScore: number,
  homeTeamId: string | null,
  awayTeamId: string | null
): Promise<void> {
  const winner = homeScore >= awayScore ? homeTeamId : awayTeamId
  if (!winner) return

  const { data: tournament } = await db
    .from('tournaments')
    .select('type, season_id')
    .eq('id', tournamentId)
    .single()

  await db.from('trophies').insert({
    tournament_id: tournamentId,
    team_id: winner,
    trophy_type: (tournament as any)?.type ?? 'ucl',
    season_id: (tournament as any)?.season_id ?? null,
  })

  await db.from('tournaments').update({ status: 'completed' }).eq('id', tournamentId)
}
