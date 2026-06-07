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
    .maybeSingle()

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
  shuffleTeams = false,
  manualQualifiers?: string[]
): Promise<{ error?: string }> {
  // Idempotency: bail if ANY knockout fixtures already exist
  const { count: existingKO } = await db
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .in('round_type', ['qf', 'sf', 'final'])

  if ((existingKO ?? 0) > 0) return { error: 'Knockout fixtures already exist' }

  // 1. Fetch tournament settings to see how many advance
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
    // Determine qualifying teams from group standings
    const { data: gs } = await db
      .from('group_standings')
      .select('team_id, group_name, points, goals_for, goals_against')
      .eq('tournament_id', tournamentId)

    if (!gs?.length) return { error: 'No group standings found' }

    // Group teams by group_name
    const groups: Record<string, any[]> = {}
    gs.forEach((s: any) => {
      if (!groups[s.group_name]) groups[s.group_name] = []
      groups[s.group_name].push(s)
    })

    // Sort each group and pick top N
    const sortedGroups = Object.keys(groups).sort().map(name => sortGroup(groups[name]))
    
    // Pairing logic (e.g. A1 vs B2, B1 vs A2)
    // For now, let's just collect all qualifiers. 
    // If we have 2 groups and 2 qualifiers each: [A1, B2, B1, A2] -> matches 201, 202
    if (numGroups === 2 && qualifiersPerGroup === 2) {
      qualifiers.push(sortedGroups[0][0].team_id, sortedGroups[1][1].team_id, sortedGroups[1][0].team_id, sortedGroups[0][1].team_id)
    } else {
      // Generic collection
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
  const fixtures: any[] = []

  // Determine starting round based on teamCount
  // 8 teams -> QF (matchdays 101-104)
  // 4 teams -> SF (matchdays 201-202)
  // 2 teams -> Final (matchday 301)

  if (teamCount === 8) {
    const dates = await getKnockoutDates(db, tournamentId, 7) // QF(4), SF(2), Final(1)
    fixtures.push(
      ...[0, 1, 2, 3].map(i => ({
        tournament_id: tournamentId,
        home_team_id: finalQualifiers[i * 2],
        away_team_id: finalQualifiers[i * 2 + 1],
        matchday: 101 + i,
        scheduled_date: dates[i],
        deadline: `${dates[i]}T12:00:00Z`,
        round_type: 'qf',
        leg: 1,
        status: 'scheduled',
      })),
      { tournament_id: tournamentId, home_team_id: null, away_team_id: null, matchday: 201, scheduled_date: dates[4], deadline: `${dates[4]}T12:00:00Z`, round_type: 'sf', leg: 1, status: 'scheduled' },
      { tournament_id: tournamentId, home_team_id: null, away_team_id: null, matchday: 202, scheduled_date: dates[5], deadline: `${dates[5]}T12:00:00Z`, round_type: 'sf', leg: 1, status: 'scheduled' },
      { tournament_id: tournamentId, home_team_id: null, away_team_id: null, matchday: 301, scheduled_date: dates[6], deadline: `${dates[6]}T12:00:00Z`, round_type: 'final', leg: 1, status: 'scheduled' }
    )
  } else if (teamCount === 4) {
    const dates = await getKnockoutDates(db, tournamentId, 3)
    fixtures.push(
      { tournament_id: tournamentId, home_team_id: finalQualifiers[0], away_team_id: finalQualifiers[1], matchday: 201, scheduled_date: dates[0], deadline: `${dates[0]}T12:00:00Z`, round_type: 'sf', leg: 1, status: 'scheduled' },
      { tournament_id: tournamentId, home_team_id: finalQualifiers[2], away_team_id: finalQualifiers[3], matchday: 202, scheduled_date: dates[1], deadline: `${dates[1]}T12:00:00Z`, round_type: 'sf', leg: 1, status: 'scheduled' },
      { tournament_id: tournamentId, home_team_id: null, away_team_id: null, matchday: 301, scheduled_date: dates[2], deadline: `${dates[2]}T12:00:00Z`, round_type: 'final', leg: 1, status: 'scheduled' }
    )
  } else {
    const dates = await getKnockoutDates(db, tournamentId, 1)
    fixtures.push({
      tournament_id: tournamentId,
      home_team_id: finalQualifiers[0],
      away_team_id: finalQualifiers[1] ?? null,
      matchday: 301,
      scheduled_date: dates[0],
      deadline: `${dates[0]}T12:00:00Z`,
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
