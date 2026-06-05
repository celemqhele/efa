import { addDays, format, parseISO } from 'date-fns'

// ─── Constants ──────────────────────────────────────────────────────────────

const KNOCKOUT_ROUNDS = ['qf', 'sf', 'final'] as const
type KnockoutRound = typeof KNOCKOUT_ROUNDS[number]

// Matchday indexing for bracket tracking
// QF: 101-104, SF: 201-202, Final: 301
const BRACKET_PROGRESSION: Record<number, { nextMd: number; slot: 'home_team_id' | 'away_team_id' }> = {
  101: { nextMd: 201, slot: 'home_team_id' },
  102: { nextMd: 201, slot: 'away_team_id' },
  103: { nextMd: 202, slot: 'home_team_id' },
  104: { nextMd: 202, slot: 'away_team_id' },
  201: { nextMd: 301, slot: 'home_team_id' },
  202: { nextMd: 301, slot: 'away_team_id' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getKnockoutDates(db: any, tournamentId: string, count: number): Promise<string[]> {
  const { data: lastGroupRow } = await db
    .from('fixtures')
    .select('scheduled_date')
    .eq('tournament_id', tournamentId)
    .eq('round_type', 'group')
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .single()

  const lastGroupDate: string = lastGroupRow?.scheduled_date
    ? String(lastGroupRow.scheduled_date).slice(0, 10)
    : format(new Date(), 'yyyy-MM-dd')

  const { data: tournament } = await db
    .from('tournaments')
    .select('season_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament?.season_id) {
    return Array.from({ length: count }, (_, i) =>
      format(addDays(parseISO(lastGroupDate), (i + 1) * 7), 'yyyy-MM-dd')
    )
  }

  const { data: siblings } = await db
    .from('tournaments')
    .select('id')
    .eq('season_id', tournament.season_id)

  const siblingIds = (siblings ?? []).map((t: any) => t.id)

  const { data: usedFx } = await db
    .from('fixtures')
    .select('scheduled_date')
    .in('tournament_id', siblingIds)

  const usedSet = new Set<string>(
    (usedFx ?? [])
      .map((f: any) => String(f.scheduled_date ?? '').slice(0, 10))
      .filter(Boolean)
  )

  const picked: string[] = []
  let cur = addDays(parseISO(lastGroupDate), 1)
  let safety = 0
  while (picked.length < count && safety++ < 365) {
    const d = format(cur, 'yyyy-MM-dd')
    if (!usedSet.has(d)) {
      picked.push(d)
      usedSet.add(d)
    }
    cur = addDays(cur, 1)
  }
  return picked
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
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Bracket Generation ───────────────────────────────────────────────────────

export async function generateTBCKnockouts(
  db: any,
  tournamentId: string,
  shuffleTeams = false
): Promise<{ error?: string }> {
  // Idempotency: bail if ANY knockout fixtures already exist
  const { count: existingKO } = await db
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .in('round_type', ['qf', 'sf', 'final'])

  if ((existingKO ?? 0) > 0) return { error: 'Knockout fixtures already exist' }

  // 1. Determine qualifying teams from group standings
  const { data: gs } = await db
    .from('group_standings')
    .select('team_id, group_name, points, goals_for, goals_against')
    .eq('tournament_id', tournamentId)

  if (!gs?.length) return { error: 'No group standings found' }

  const grpA = sortGroup((gs ?? []).filter((s: any) => s.group_name === 'A'))
  const grpB = sortGroup((gs ?? []).filter((s: any) => s.group_name === 'B'))
  
  // Decide how many teams advance. Currently UCL/Europa are 2 groups -> 4 advance to SF.
  // We'll support 4 teams (SF start) or 8 teams (QF start) if more groups added later.
  
  const qualifiers: string[] = []
  if (grpA.length > 0 && grpB.length > 0) {
    if (gs.length >= 16) {
      // 8 teams advance (Top 4 from each or something? Let's stick to Top 2 for now)
      // Actually let's just use what's there.
    }
    // Standard UCL/Europa: Top 2 from each -> SF
    qualifiers.push(grpA[0].team_id, grpB[1].team_id, grpB[0].team_id, grpA[1].team_id)
  }

  const teamCount = qualifiers.length
  if (teamCount < 2) return { error: 'Not enough teams to start knockouts' }

  // Dates for SF1, SF2, Final (3 dates)
  const dates = await getKnockoutDates(db, tournamentId, 3)
  const d1 = dates[0] ?? format(addDays(new Date(), 7), 'yyyy-MM-dd')
  const d2 = dates[1] ?? format(addDays(new Date(), 14), 'yyyy-MM-dd')
  const d3 = dates[2] ?? format(addDays(new Date(), 21), 'yyyy-MM-dd')

  const finalQualifiers = shuffleTeams ? shuffle(qualifiers) : qualifiers

  const fixtures: any[] = []

  if (teamCount === 4) {
    // SF -> Final
    fixtures.push(
      {
        tournament_id: tournamentId,
        home_team_id: finalQualifiers[0],
        away_team_id: finalQualifiers[1],
        matchday: 201,
        scheduled_date: d1,
        deadline: `${d1}T12:00:00Z`,
        round_type: 'sf',
        leg: 1,
        status: 'scheduled',
      },
      {
        tournament_id: tournamentId,
        home_team_id: finalQualifiers[2],
        away_team_id: finalQualifiers[3],
        matchday: 202,
        scheduled_date: d2,
        deadline: `${d2}T12:00:00Z`,
        round_type: 'sf',
        leg: 1,
        status: 'scheduled',
      },
      {
        tournament_id: tournamentId,
        home_team_id: null,
        away_team_id: null,
        matchday: 301,
        scheduled_date: d3,
        deadline: `${d3}T12:00:00Z`,
        round_type: 'final',
        leg: 1,
        status: 'scheduled',
      }
    )
  } else {
    // Basic 2-team final for other counts or standalone
    fixtures.push({
      tournament_id: tournamentId,
      home_team_id: finalQualifiers[0],
      away_team_id: finalQualifiers[1] ?? null,
      matchday: 301,
      scheduled_date: d1,
      deadline: `${d1}T12:00:00Z`,
      round_type: 'final',
      leg: 1,
      status: 'scheduled',
    })
  }

  const { error } = await db.from('fixtures').insert(fixtures)
  if (error) return { error: error.message }
  return {}
}

// ─── Advancement Logic ────────────────────────────────────────────────────────

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
  if (!winnerId) return // Handle draws if needed (penalties?) - for now assume winner exists

  // Fetch current fixture to get its matchday
  const { data: curFx } = await db
    .from('fixtures')
    .select('matchday, round_type')
    .eq('id', fixtureId)
    .single()

  if (!curFx) return

  const progression = BRACKET_PROGRESSION[curFx.matchday]
  if (!progression) {
    // If it's a final, award trophy
    if (curFx.round_type === 'final') {
      await awardTrophy(db, tournamentId, homeScore, awayScore, homeTeamId, awayTeamId)
    }
    return
  }

  // Find the next fixture in the bracket
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

// ─── Award trophy ─────────────────────────────────────────────────────────────

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
