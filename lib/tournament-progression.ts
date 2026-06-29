import { addDays, format, parseISO } from 'date-fns'

type KnockoutRound = 'r16' | 'qf' | 'sf' | 'final'

const BRACKET_PROGRESSION: Record<number, { nextMd: number; slot: 'home_team_id' | 'away_team_id' }> = {
  // Single-leg R16 → QF
  51: { nextMd: 101, slot: 'home_team_id' },
  52: { nextMd: 101, slot: 'away_team_id' },
  53: { nextMd: 102, slot: 'home_team_id' },
  54: { nextMd: 102, slot: 'away_team_id' },
  55: { nextMd: 103, slot: 'home_team_id' },
  56: { nextMd: 103, slot: 'away_team_id' },
  57: { nextMd: 104, slot: 'home_team_id' },
  58: { nextMd: 104, slot: 'away_team_id' },
  // 2-leg R16 leg 2 → QF
  61: { nextMd: 101, slot: 'home_team_id' },
  62: { nextMd: 101, slot: 'away_team_id' },
  63: { nextMd: 102, slot: 'home_team_id' },
  64: { nextMd: 102, slot: 'away_team_id' },
  65: { nextMd: 103, slot: 'home_team_id' },
  66: { nextMd: 103, slot: 'away_team_id' },
  67: { nextMd: 104, slot: 'home_team_id' },
  68: { nextMd: 104, slot: 'away_team_id' },
  // Single-leg QF → SF
  101: { nextMd: 201, slot: 'home_team_id' },
  102: { nextMd: 201, slot: 'away_team_id' },
  103: { nextMd: 202, slot: 'home_team_id' },
  104: { nextMd: 202, slot: 'away_team_id' },
  // 2-leg QF leg 2 → SF
  111: { nextMd: 201, slot: 'home_team_id' },
  112: { nextMd: 201, slot: 'away_team_id' },
  113: { nextMd: 202, slot: 'home_team_id' },
  114: { nextMd: 202, slot: 'away_team_id' },
  // Single-leg SF → Final
  201: { nextMd: 301, slot: 'home_team_id' },
  202: { nextMd: 301, slot: 'away_team_id' },
  // 2-leg SF leg 2 → Final
  211: { nextMd: 301, slot: 'home_team_id' },
  212: { nextMd: 301, slot: 'away_team_id' },
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

function buildBracketHalf(groupIndices: number[], sortedGroups: any[][]): string[] {
  const w = (i: number) => sortedGroups[i]?.[0]?.team_id
  const r = (i: number) => sortedGroups[i]?.[1]?.team_id

  const winners = shuffle(groupIndices)
  const runnersUp = shuffle(groupIndices)

  for (let i = 0; i < winners.length; i++) {
    if (winners[i] === runnersUp[i]) {
      const swapIdx = (i + 1) % runnersUp.length
      ;[runnersUp[i], runnersUp[swapIdx]] = [runnersUp[swapIdx], runnersUp[i]]
    }
  }

  const result: string[] = []
  for (let i = 0; i < winners.length; i++) {
    result.push(w(winners[i]), r(runnersUp[i]))
  }
  return result
}

function buildQualifierOrder(sortedGroups: any[][], numGroups: number, qualifiersPerGroup: number): string[] {
  const w = (i: number) => sortedGroups[i]?.[0]?.team_id
  const r = (i: number) => sortedGroups[i]?.[1]?.team_id

  if (numGroups === 8 && qualifiersPerGroup === 2) {
    const topHalf = buildBracketHalf([0, 1, 2, 3], sortedGroups)
    const botHalf = buildBracketHalf([4, 5, 6, 7], sortedGroups)
    return [...topHalf, ...botHalf]
  }

  if (numGroups === 4 && qualifiersPerGroup === 2) {
    return buildBracketHalf([0, 1, 2, 3], sortedGroups)
  }

  if (numGroups === 2 && qualifiersPerGroup === 2) {
    const pair = [w(0), r(1), w(1), r(0)]
    return Math.random() < 0.5 ? pair : [pair[2], pair[3], pair[0], pair[1]]
  }

  if (qualifiersPerGroup === 2) {
    const halfSize = Math.ceil(numGroups / 2)
    const topIndices = Array.from({ length: halfSize }, (_, i) => i)
    const botIndices = Array.from({ length: numGroups - halfSize }, (_, i) => i + halfSize)
    const topHalf = buildBracketHalf(topIndices, sortedGroups)
    const botHalf = botIndices.length > 0 ? buildBracketHalf(botIndices, sortedGroups) : []
    return [...topHalf, ...botHalf]
  }

  const qualifiers: string[] = []
  for (let i = 0; i < qualifiersPerGroup; i++) {
    for (let j = 0; j < numGroups; j++) {
      if (sortedGroups[j] && sortedGroups[j][i]) {
        qualifiers.push(sortedGroups[j][i].team_id)
      }
    }
  }
  return qualifiers
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

  const today = format(new Date(), 'yyyy-MM-dd')
  const afterDate: string = lastGroupRow?.scheduled_date
    ? String(lastGroupRow.scheduled_date).slice(0, 10)
    : today

  const candidateDate = format(addDays(parseISO(afterDate), 1), 'yyyy-MM-dd')
  const startDate = candidateDate > today ? candidateDate : today

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
  manualQualifiers?: string[],
  numLegs: number = 1
): Promise<{ error?: string }> {
  const { count: existingKO } = await db
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .in('round_type', ['r16', 'qf', 'sf', 'final'])

  if ((existingKO ?? 0) > 0) return { error: 'Knockout fixtures already exist' }

  const { data: tournament } = await db
    .from('tournaments')
    .select('settings, type')
    .eq('id', tournamentId)
    .single()

  const settings = (tournament?.settings as any) || {}
  const qualifiersPerGroup = settings.qualifiers_per_group ?? 2
  const numGroups = settings.num_groups ?? 2

  let finalQualifiers: string[] = []

  if (manualQualifiers && manualQualifiers.length >= 2) {
    finalQualifiers = manualQualifiers
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
    finalQualifiers = buildQualifierOrder(sortedGroups, numGroups, qualifiersPerGroup)
  }

  const teamCount = finalQualifiers.length
  if (teamCount < 2) return { error: 'Not enough teams to start knockouts' }

  // Build fixture templates (without dates) to pass to slot assigner
  interface KOFixture { home_team_id: string | null; away_team_id: string | null; matchday: number; round_type: KnockoutRound; leg: number }
  const koFixtures: KOFixture[] = []

  const isTwoLeg = numLegs === 2

  if (teamCount === 16) {
    // R16 leg 1
    for (let i = 0; i < 8; i++) {
      koFixtures.push({
        home_team_id: finalQualifiers[i * 2],
        away_team_id: finalQualifiers[i * 2 + 1],
        matchday: 51 + i,
        round_type: 'r16',
        leg: 1,
      })
    }
    // R16 leg 2 (if 2-leg)
    if (isTwoLeg) {
      for (let i = 0; i < 8; i++) {
        koFixtures.push({
          home_team_id: finalQualifiers[i * 2 + 1],
          away_team_id: finalQualifiers[i * 2],
          matchday: 61 + i,
          round_type: 'r16',
          leg: 2,
        })
      }
    }
    // QF leg 1 (TBC)
    for (let i = 0; i < 4; i++) {
      koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 101 + i, round_type: 'qf', leg: 1 })
    }
    // QF leg 2 (if 2-leg)
    if (isTwoLeg) {
      for (let i = 0; i < 4; i++) {
        koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 111 + i, round_type: 'qf', leg: 2 })
      }
    }
    // SF leg 1
    koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 201, round_type: 'sf', leg: 1 })
    koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 202, round_type: 'sf', leg: 1 })
    // SF leg 2 (if 2-leg)
    if (isTwoLeg) {
      koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 211, round_type: 'sf', leg: 2 })
      koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 212, round_type: 'sf', leg: 2 })
    }
    // Final
    koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 301, round_type: 'final', leg: 1 })
  } else if (teamCount === 8) {
    // QF leg 1
    for (let i = 0; i < 4; i++) {
      koFixtures.push({
        home_team_id: finalQualifiers[i * 2],
        away_team_id: finalQualifiers[i * 2 + 1],
        matchday: 101 + i,
        round_type: 'qf',
        leg: 1,
      })
    }
    // QF leg 2 (if 2-leg)
    if (isTwoLeg) {
      for (let i = 0; i < 4; i++) {
        koFixtures.push({
          home_team_id: finalQualifiers[i * 2 + 1],
          away_team_id: finalQualifiers[i * 2],
          matchday: 111 + i,
          round_type: 'qf',
          leg: 2,
        })
      }
    }
    // SF leg 1
    koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 201, round_type: 'sf', leg: 1 })
    koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 202, round_type: 'sf', leg: 1 })
    // SF leg 2 (if 2-leg)
    if (isTwoLeg) {
      koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 211, round_type: 'sf', leg: 2 })
      koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 212, round_type: 'sf', leg: 2 })
    }
    // Final
    koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 301, round_type: 'final', leg: 1 })
  } else if (teamCount === 4) {
    // SF leg 1
    koFixtures.push({ home_team_id: finalQualifiers[0], away_team_id: finalQualifiers[1], matchday: 201, round_type: 'sf', leg: 1 })
    koFixtures.push({ home_team_id: finalQualifiers[2], away_team_id: finalQualifiers[3], matchday: 202, round_type: 'sf', leg: 1 })
    // SF leg 2 (if 2-leg)
    if (isTwoLeg) {
      koFixtures.push({ home_team_id: finalQualifiers[1], away_team_id: finalQualifiers[0], matchday: 211, round_type: 'sf', leg: 2 })
      koFixtures.push({ home_team_id: finalQualifiers[3], away_team_id: finalQualifiers[2], matchday: 212, round_type: 'sf', leg: 2 })
    }
    // Final
    koFixtures.push({ home_team_id: null, away_team_id: null, matchday: 301, round_type: 'final', leg: 1 })
  } else if (teamCount === 2) {
    koFixtures.push({ home_team_id: finalQualifiers[0], away_team_id: finalQualifiers[1] ?? null, matchday: 301, round_type: 'final', leg: 1 })
  } else {
    return { error: `Unsupported knockout team count: ${teamCount}. Only 2, 4, 8, or 16 teams are supported.` }
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
    leg: kf.leg,
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
  const { data: curFx } = await db
    .from('fixtures')
    .select('matchday, round_type, leg')
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

  // For 2-leg: leg 1 → don't advance yet, wait for leg 2
  if (curFx.leg === 1) {
    const siblingMd = curFx.matchday + 10
    const { data: leg2Fx } = await db
      .from('fixtures')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('matchday', siblingMd)
      .maybeSingle()
    if (leg2Fx) return // 2-leg mode, wait for leg 2
  }

  let winnerId: string | null = null

  if (curFx.leg === 2) {
    // 2-leg aggregate: find leg 1 result
    const leg1Md = curFx.matchday - 10
    const { data: leg1Fixtures } = await db
      .from('fixtures')
      .select('*, results(*)')
      .eq('tournament_id', tournamentId)
      .eq('matchday', leg1Md)
      .maybeSingle()

    if (leg1Fixtures) {
      const leg1Result = Array.isArray(leg1Fixtures.results)
        ? leg1Fixtures.results[0]
        : leg1Fixtures.results

      if (leg1Result) {
        const leg1HS = leg1Result.home_score ?? 0
        const leg1AS = leg1Result.away_score ?? 0

        // leg 1: home=TeamA, away=TeamB; leg 2: home=TeamB, away=TeamA
        const teamAGoals = leg1HS + awayScore
        const teamBGoals = leg1AS + homeScore

        if (teamAGoals > teamBGoals) {
          winnerId = leg1Fixtures.home_team_id
        } else if (teamBGoals > teamAGoals) {
          winnerId = leg1Fixtures.away_team_id
        } else {
          // Aggregate level — check pen scores on leg 2 result
          const penHome = (leg1Result as any).pen_home_score
          const penAway = (leg1Result as any).pen_away_score

          // pen scores are stored on leg 2's result, so we need to fetch leg 2's result for pen scores
          const { data: leg2FixtureWithResult } = await db
            .from('fixtures')
            .select('*, results(*)')
            .eq('tournament_id', tournamentId)
            .eq('matchday', curFx.matchday)
            .maybeSingle()

          if (leg2FixtureWithResult) {
            const leg2Result = Array.isArray(leg2FixtureWithResult.results)
              ? leg2FixtureWithResult.results[0]
              : leg2FixtureWithResult.results

            if (leg2Result) {
              const ph = (leg2Result as any).pen_home_score
              const pa = (leg2Result as any).pen_away_score
              if (ph != null && pa != null) {
                if (ph > pa) winnerId = leg2FixtureWithResult.home_team_id
                else if (pa > ph) winnerId = leg2FixtureWithResult.away_team_id
              }
            }
          }

          // Fallback: leg 2 result as tiebreaker
          if (!winnerId) {
            winnerId = homeScore > awayScore ? homeTeamId : awayScore > homeScore ? awayTeamId : null
          }
        }
      } else {
        // No leg 1 result — fallback to single result
        winnerId = homeScore > awayScore ? homeTeamId : awayScore > homeScore ? awayTeamId : null
      }
    } else {
      // No leg 1 fixture — fallback to single result
      winnerId = homeScore > awayScore ? homeTeamId : awayScore > homeScore ? awayTeamId : null
    }
  } else {
    // Single-leg: use direct result
    winnerId = homeScore > awayScore ? homeTeamId : awayScore > homeScore ? awayTeamId : null
  }

  if (!winnerId) return

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
    trophy_type: (tournament as any)?.type ?? 'league',
    season_id: (tournament as any)?.season_id ?? null,
  })

  await db.from('tournaments').update({ status: 'completed' }).eq('id', tournamentId)
}
