import { addDays, format, parseISO } from 'date-fns'

// ─── Date picking ─────────────────────────────────────────────────────────────

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

// ─── Sort group standings ─────────────────────────────────────────────────────

function sortGroup(teams: any[]): any[] {
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = (a.goals_for ?? 0) - (a.goals_against ?? 0)
    const gdB = (b.goals_for ?? 0) - (b.goals_against ?? 0)
    if (gdB !== gdA) return gdB - gdA
    return (b.goals_for ?? 0) - (a.goals_for ?? 0)
  })
}

// ─── Generate TBC knockout fixtures ──────────────────────────────────────────
// NOTE: fixtures.home_team_id and away_team_id must be nullable in the DB for
// the Final placeholder to work (ALTER TABLE fixtures ALTER COLUMN home_team_id DROP NOT NULL)

export async function generateTBCKnockouts(
  db: any,
  tournamentId: string
): Promise<{ error?: string }> {
  // Idempotency: bail if SF fixtures already exist
  const { count: existingSF } = await db
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('round_type', 'sf')

  if ((existingSF ?? 0) > 0) return { error: 'SF fixtures already exist' }

  const { data: gs } = await db
    .from('group_standings')
    .select('team_id, group_name, points, goals_for, goals_against')
    .eq('tournament_id', tournamentId)

  if (!gs?.length) return { error: 'No group standings found' }

  const grpA = sortGroup((gs ?? []).filter((s: any) => s.group_name === 'A'))
  const grpB = sortGroup((gs ?? []).filter((s: any) => s.group_name === 'B'))

  // 1st A vs 2nd B → SF1; 1st B vs 2nd A → SF2
  const sf1Home: string | null = grpA[0]?.team_id ?? null
  const sf1Away: string | null = grpB[1]?.team_id ?? null
  const sf2Home: string | null = grpB[0]?.team_id ?? null
  const sf2Away: string | null = grpA[1]?.team_id ?? null

  const { data: maxMdRow } = await db
    .from('fixtures')
    .select('matchday')
    .eq('tournament_id', tournamentId)
    .eq('round_type', 'group')
    .order('matchday', { ascending: false })
    .limit(1)
    .single()

  const maxMd: number = (maxMdRow as any)?.matchday ?? 10

  const dates = await getKnockoutDates(db, tournamentId, 3)
  const d1 = dates[0] ?? format(addDays(new Date(), 7), 'yyyy-MM-dd')
  const d2 = dates[1] ?? format(addDays(new Date(), 14), 'yyyy-MM-dd')
  const d3 = dates[2] ?? format(addDays(new Date(), 21), 'yyyy-MM-dd')

  const { error } = await db.from('fixtures').insert([
    {
      tournament_id: tournamentId,
      home_team_id: sf1Home,
      away_team_id: sf1Away,
      matchday: maxMd + 1,
      scheduled_date: d1,
      deadline: `${d1}T12:00:00Z`,
      round_type: 'sf',
      leg: 1,
      status: 'scheduled',
      is_postponed: false,
    },
    {
      tournament_id: tournamentId,
      home_team_id: sf2Home,
      away_team_id: sf2Away,
      matchday: maxMd + 2,
      scheduled_date: d2,
      deadline: `${d2}T12:00:00Z`,
      round_type: 'sf',
      leg: 1,
      status: 'scheduled',
      is_postponed: false,
    },
    {
      tournament_id: tournamentId,
      home_team_id: null,
      away_team_id: null,
      matchday: maxMd + 3,
      scheduled_date: d3,
      deadline: `${d3}T12:00:00Z`,
      round_type: 'final',
      leg: 1,
      status: 'scheduled',
      is_postponed: false,
    },
  ])

  if (error) return { error: error.message }
  return {}
}

// ─── Fill Final slot with SF winner ──────────────────────────────────────────

export async function fillFinalSlot(
  db: any,
  tournamentId: string,
  sfFixtureId: string,
  homeScore: number,
  awayScore: number,
  homeTeamId: string | null,
  awayTeamId: string | null
): Promise<void> {
  const winner = homeScore >= awayScore ? homeTeamId : awayTeamId

  // Get all SF fixtures for this tournament sorted by matchday
  const { data: allSFs } = await db
    .from('fixtures')
    .select('id, matchday')
    .eq('tournament_id', tournamentId)
    .eq('round_type', 'sf')
    .order('matchday', { ascending: true })

  if (!allSFs?.length) return

  // Find Final fixture
  const { data: finalFx } = await db
    .from('fixtures')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round_type', 'final')
    .single()

  if (!finalFx) return

  const sfIndex = (allSFs as any[]).findIndex((f) => f.id === sfFixtureId)
  // SF1 (index 0) → home slot; SF2 (index 1) → away slot
  const field = sfIndex === 0 ? 'home_team_id' : 'away_team_id'

  await db.from('fixtures').update({ [field]: winner }).eq('id', finalFx.id)
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
