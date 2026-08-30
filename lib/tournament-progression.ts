import { addDays, format, parseISO } from 'date-fns'
import { determineAggregateWinner } from './aggregate'
import { createAdminClient } from '@/lib/supabase/server'
import { stampFixtureParticipants } from '@/lib/slot-utils'

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


interface QualifierEntry {
  team_id: string
  group_name: string
  points: number
  gd: number
  gf: number
}

function buildQualifierOrder(sortedGroups: any[][], numGroups: number, qualifiersPerGroup: number): string[] {
  // Step 1: Flatten all qualifiers
  const allQualifiers: QualifierEntry[] = []
  for (const group of sortedGroups) {
    const groupName = group[0]?.group_name ?? 'A'
    for (let i = 0; i < qualifiersPerGroup && i < group.length; i++) {
      const t = group[i]
      allQualifiers.push({
        team_id: t.team_id,
        group_name: groupName,
        points: t.points ?? 0,
        gd: (t.goals_for ?? 0) - (t.goals_against ?? 0),
        gf: t.goals_for ?? 0,
      })
    }
  }

  // Step 2: Global ranking by points → GD → GF
  allQualifiers.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    return b.gf - a.gf
  })

  const total = allQualifiers.length
  if (total === 0) return []

  // Step 3: Odd/even split into halves (rank 1,3,5... → half 1; 2,4,6... → half 2)
  const half1: QualifierEntry[] = []
  const half2: QualifierEntry[] = []
  for (let i = 0; i < total; i++) {
    if (i % 2 === 0) half1.push(allQualifiers[i])
    else half2.push(allQualifiers[i])
  }

  // Step 4: Assign to QF lots within each half, separating same-group teams
  function assignHalf(half: QualifierEntry[]): string[] {
    const n = half.length
    if (n === 0) return []

    // Lot size: 4 for 16-team (2 QF lots per half), 2 for 8/4-team
    const lotSize = total >= 16 ? 4 : 2
    const numLots = Math.ceil(n / lotSize)
    const lots: QualifierEntry[][] = Array.from({ length: numLots }, () => [])
    const usedGroups = new Map<string, Set<number>>()

    for (const q of half) {
      const group = q.group_name
      if (!usedGroups.has(group)) usedGroups.set(group, new Set())
      const busyLots = usedGroups.get(group)!

      // Find a lot not already containing this group, preferring emptier lots
      let bestLot = -1
      let bestLen = Infinity
      for (let li = 0; li < numLots; li++) {
        if (busyLots.has(li)) continue
        if (lots[li].length < lotSize && lots[li].length < bestLen) {
          bestLen = lots[li].length
          bestLot = li
        }
      }

      // Fallback: all lots have this group or are full — pick least full
      if (bestLot === -1) {
        for (let li = 0; li < numLots; li++) {
          if (lots[li].length < lotSize && lots[li].length < bestLen) {
            bestLen = lots[li].length
            bestLot = li
          }
        }
      }

      if (bestLot >= 0) {
        lots[bestLot].push(q)
        busyLots.add(bestLot)
      }
    }

    // Shuffle within each lot and flatten
    const result: string[] = []
    for (const lot of lots) {
      for (let i = lot.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lot[i], lot[j]] = [lot[j], lot[i]]
      }
      for (const q of lot) result.push(q.team_id)
    }
    return result
  }

  return [...assignHalf(half1), ...assignHalf(half2)]
}

const ROUND_STAGE_OFFSET: Record<string, number> = {
  r16: 0, qf: 1, sf: 2, final: 3,
}

const KO_DAILY_CAP = 5

async function assignKnockoutDates(
  db: any,
  fixtures: Array<{ home_team_id: string | null; away_team_id: string | null; round_type: string }>,
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
  const baseStartDate = candidateDate > today ? candidateDate : today

  const slotCache: Record<string, { globalUsed: number; teamUsed: Record<string, number> }> = {}
  const runDayCount: Record<string, number> = {}

  const dates: string[] = []

  for (const fx of fixtures) {
    const roundDate = format(addDays(parseISO(baseStartDate), ROUND_STAGE_OFFSET[fx.round_type] ?? 0), 'yyyy-MM-dd')
    let currentDate = parseISO(roundDate)
    let assigned = false

    for (let safety = 0; safety < 730; safety++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')

      if ((runDayCount[dateStr] ?? 0) >= KO_DAILY_CAP) {
        currentDate = addDays(currentDate, 1)
        continue
      }

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
        runDayCount[dateStr] = (runDayCount[dateStr] ?? 0) + 1
        if (fx.home_team_id) state.teamUsed[fx.home_team_id] = (state.teamUsed[fx.home_team_id] ?? 0) + 1
        if (fx.away_team_id) state.teamUsed[fx.away_team_id] = (state.teamUsed[fx.away_team_id] ?? 0) + 1
        assigned = true
        break
      }

      currentDate = addDays(currentDate, 1)
    }

    if (!assigned) {
      dates.push(format(addDays(parseISO(baseStartDate), dates.length), 'yyyy-MM-dd'))
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

  const stamped = await stampFixtureParticipants(db, tournamentId, insertFixtures)
  const { error } = await db.from('fixtures').insert(stamped)
  if (error) return { error: error.message }
  return {}
}

function firstResultRow(r: any): any {
  if (Array.isArray(r)) return r[0] ?? null
  return r ?? null
}

const NEXT_ROUND_LEG1_MDS = [101, 102, 103, 104, 201, 202]

async function mirrorLeg2Teams(
  db: any,
  tournamentId: string,
  leg1Matchday: number
): Promise<void> {
  if (!NEXT_ROUND_LEG1_MDS.includes(leg1Matchday)) return

  const { data: leg1 } = await db
    .from('fixtures')
    .select('home_team_id, away_team_id')
    .eq('tournament_id', tournamentId)
    .eq('matchday', leg1Matchday)
    .maybeSingle()

  if (!leg1 || (!leg1.home_team_id && !leg1.away_team_id)) return

  const patch: Record<string, string> = {}
  if (leg1.away_team_id) patch.home_team_id = leg1.away_team_id
  if (leg1.home_team_id) patch.away_team_id = leg1.home_team_id

  await db
    .from('fixtures')
    .update(patch)
    .eq('tournament_id', tournamentId)
    .eq('matchday', leg1Matchday + 10)
}

async function checkTournamentCompletion(db: any, tournamentId: string): Promise<void> {
  const { data: tournament } = await db
    .from('tournaments')
    .select('type, status')
    .eq('id', tournamentId)
    .single()

  if (!tournament || tournament.status !== 'active' || tournament.type === 'league') return

  const { count: total } = await db
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  if (!total || total === 0) return

  const { count: pending } = await db
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .not('status', 'in', '("confirmed","abandoned_home","abandoned_away","abandoned_both")')

  if ((pending ?? 0) === 0) {
    await db.from('tournaments').update({ status: 'completed' }).eq('id', tournamentId)
  }
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
      await checkAndCreateSuperCup(db, tournamentId)
    }
    await checkTournamentCompletion(db, tournamentId)
    return
  }

  let winnerId: string | null = null

  const siblingMd = curFx.leg === 1 ? curFx.matchday + 10 : curFx.matchday - 10
  const { data: siblingFx } = await db
    .from('fixtures')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('matchday', siblingMd)
    .maybeSingle()

  if (siblingFx) {
    const leg1Md = curFx.leg === 1 ? curFx.matchday : siblingMd
    const leg2Md = curFx.leg === 1 ? siblingMd : curFx.matchday

    const { data: leg1Fix } = await db
      .from('fixtures')
      .select('*, results(*)')
      .eq('tournament_id', tournamentId)
      .eq('matchday', leg1Md)
      .maybeSingle()
    const { data: leg2Fix } = await db
      .from('fixtures')
      .select('*, results(*)')
      .eq('tournament_id', tournamentId)
      .eq('matchday', leg2Md)
      .maybeSingle()

    const leg1Result = firstResultRow(leg1Fix?.results)
    const leg2Result = firstResultRow(leg2Fix?.results)

    if (!leg1Fix || !leg2Fix || !leg1Result || !leg2Result) return

    winnerId = determineAggregateWinner(leg1Fix, leg1Result, leg2Fix, leg2Result)
  } else {
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

    await mirrorLeg2Teams(db, tournamentId, progression.nextMd)
  }

  await checkTournamentCompletion(db, tournamentId)
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

async function checkAndCreateSuperCup(db: any, justCompletedTournamentId: string): Promise<void> {
  const adminDb = await createAdminClient()

  const { data: tournament } = await adminDb
    .from('tournaments')
    .select('season_id')
    .eq('id', justCompletedTournamentId)
    .single()

  const seasonId = tournament?.season_id
  if (!seasonId) return

  const { data: clubTs } = await adminDb
    .from('tournaments')
    .select('id, name')
    .eq('season_id', seasonId)
    .eq('type', 'tournament_club')

  if (!clubTs || clubTs.length < 2) return

  const uclT = clubTs[0]
  const europaT = clubTs[1]

  const { data: uclTrophy } = await adminDb
    .from('trophies')
    .select('team_id')
    .eq('tournament_id', uclT.id)
    .limit(1)
    .maybeSingle()

  const { data: europaTrophy } = await adminDb
    .from('trophies')
    .select('team_id')
    .eq('tournament_id', europaT.id)
    .limit(1)
    .maybeSingle()

  if (!uclTrophy || !europaTrophy) return

  const { data: existing } = await adminDb
    .from('tournaments')
    .select('id')
    .eq('season_id', seasonId)
    .eq('type', 'friendlies')
    .contains('settings', { is_super_cup: true })
    .limit(1)
    .maybeSingle()

  if (existing) return

  const uclWinnerId = uclTrophy.team_id
  const europaWinnerId = europaTrophy.team_id

  const { data: uclFinal } = await adminDb
    .from('fixtures')
    .select('scheduled_date')
    .eq('tournament_id', uclT.id)
    .eq('round_type', 'final')
    .limit(1)
    .maybeSingle()

  const { data: europaFinal } = await adminDb
    .from('fixtures')
    .select('scheduled_date')
    .eq('tournament_id', europaT.id)
    .eq('round_type', 'final')
    .limit(1)
    .maybeSingle()

  const uclDate = uclFinal?.scheduled_date ? new Date(uclFinal.scheduled_date) : new Date()
  const europaDate = europaFinal?.scheduled_date ? new Date(europaFinal.scheduled_date) : new Date()
  const laterDate = uclDate > europaDate ? uclDate : europaDate
  const scheduledDate = format(addDays(laterDate, 1), 'yyyy-MM-dd')

  const { data: scTournament, error: tErr } = await adminDb
    .from('tournaments')
    .insert({
      season_id: seasonId,
      name: 'EFA Super Cup',
      type: 'friendlies',
      status: 'active',
      settings: { is_super_cup: true },
    })
    .select('id')
    .single()

  if (tErr || !scTournament) return

  const { data: scParticipants } = await adminDb.from('tournament_participants').insert([
    { tournament_id: scTournament.id, team_id: uclWinnerId },
    { tournament_id: scTournament.id, team_id: europaWinnerId },
  ]).select('id, team_id')

  const scParticipantByTeam = new Map<string, string>()
  for (const row of scParticipants ?? []) {
    if (row.team_id) scParticipantByTeam.set(row.team_id, row.id)
  }

  await adminDb.from('fixtures').insert({
    tournament_id: scTournament.id,
    home_team_id: uclWinnerId,
    away_team_id: europaWinnerId,
    home_participant_id: scParticipantByTeam.get(uclWinnerId) ?? null,
    away_participant_id: scParticipantByTeam.get(europaWinnerId) ?? null,
    matchday: 1,
    round_type: 'final',
    status: 'scheduled',
    scheduled_date: scheduledDate,
    deadline: `${scheduledDate}T20:00:00Z`,
  })

  const { data: adminUser } = await adminDb
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  await adminDb.from('audit_log').insert({
    admin_id: adminUser?.id ?? justCompletedTournamentId,
    action: 'auto_generate_super_cup',
    target_type: 'tournament',
    target_id: scTournament.id,
    details: { season_id: seasonId, ucl_winner_id: uclWinnerId, europa_winner_id: europaWinnerId },
  })
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
