import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseScreenshot } from '@/lib/screenshot-parser'

type StatValue = number | null
type StatPair = { home: StatValue; away: StatValue }

type ParsedScreenshotLike = Awaited<ReturnType<typeof parseScreenshot>> & {
  matchStatus?: string | null
  status?: string | null
  stats?: unknown
}

type TeamMappings = {
  home?: string
  away?: string
}

type FixtureContext = {
  source: 'formData' | 'database' | 'none'
  fixtureId?: string
  homeTeamId?: string
  awayTeamId?: string
  table?: string
}

type AdminSupabase = Awaited<ReturnType<typeof createAdminClient>>

const STAT_DEFINITIONS = [
  { key: 'possession', aliases: ['possession'] },
  { key: 'shots', aliases: ['shots', 'total shots'] },
  { key: 'shotsOnTarget', aliases: ['shots on target', 'shotsontarget', 'shots_on_target', 'sot'] },
  { key: 'fouls', aliases: ['fouls'] },
  { key: 'offsides', aliases: ['offsides', 'offside'] },
  { key: 'cornerKicks', aliases: ['corner kicks', 'corners', 'corner_kicks', 'cornerkicks'] },
  { key: 'freeKicks', aliases: ['free kicks', 'free_kicks', 'freekicks'] },
  { key: 'passes', aliases: ['passes', 'total passes'] },
  { key: 'successfulPasses', aliases: ['successful passes', 'successfulpasses', 'successful_passes', 'completed passes'] },
  { key: 'crosses', aliases: ['crosses'] },
  { key: 'interceptions', aliases: ['interceptions'] },
  { key: 'tackles', aliases: ['tackles'] },
  { key: 'saves', aliases: ['saves'] },
] as const

type StatKey = (typeof STAT_DEFINITIONS)[number]['key']
type NormalizedStats = Record<StatKey, StatPair>

function emptyStats(): NormalizedStats {
  return Object.fromEntries(
    STAT_DEFINITIONS.map(({ key }) => [key, { home: null, away: null }]),
  ) as NormalizedStats
}

function normalizeLabel(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

function normalizeForMatching(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '')
    const match = cleaned.match(/-?\d+(?:\.\d+)?/)
    return match ? Number(match[0]) : null
  }

  if (value && typeof value === 'object' && 'value' in value) {
    return toNumber((value as { value?: unknown }).value)
  }

  return null
}

function numbersFromString(value: string) {
  return [...value.replace(/,/g, '').matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]))
}

function firstNumberFromKeys(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in record) {
      const value = toNumber(record[key])
      if (value !== null) return value
    }
  }

  return null
}

function extractStatPair(value: unknown): StatPair | null {
  if (Array.isArray(value)) {
    const values = value.map(toNumber).filter((item): item is number => item !== null)
    if (values.length >= 2) return { home: values[0], away: values[1] }
    return null
  }

  if (typeof value === 'string') {
    const values = numbersFromString(value)
    if (values.length >= 2) return { home: values[0], away: values[values.length - 1] }
    return null
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    if (Array.isArray(record.values)) {
      return extractStatPair(record.values)
    }

    const home = firstNumberFromKeys(record, [
      'home',
      'homeValue',
      'home_value',
      'left',
      'leftValue',
      'left_value',
      'team1',
      'teamOne',
      'team_one',
    ])

    const away = firstNumberFromKeys(record, [
      'away',
      'awayValue',
      'away_value',
      'right',
      'rightValue',
      'right_value',
      'team2',
      'teamTwo',
      'team_two',
    ])

    if (home !== null || away !== null) {
      return { home, away }
    }

    const combined = Object.values(record)
      .filter((item) => typeof item === 'string' || typeof item === 'number')
      .join(' ')
    const values = numbersFromString(combined)

    if (values.length >= 2) return { home: values[0], away: values[values.length - 1] }
  }

  return null
}

function statKeyFromLabel(label: unknown): StatKey | null {
  const normalized = normalizeLabel(label)

  for (const definition of STAT_DEFINITIONS) {
    if (definition.aliases.some((alias) => normalizeLabel(alias) === normalized)) {
      return definition.key
    }
  }

  return null
}

function normalizeStats(rawStats: unknown): NormalizedStats {
  const normalizedStats = emptyStats()
  const rows: Array<{ label: unknown; value: unknown }> = []

  if (rawStats && typeof rawStats === 'object' && !Array.isArray(rawStats)) {
    for (const [label, value] of Object.entries(rawStats)) {
      rows.push({ label, value })

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>
        const nestedLabel = record.label ?? record.name ?? record.stat ?? record.statName ?? record.stat_name
        if (nestedLabel) rows.push({ label: nestedLabel, value })
      }
    }
  }

  if (Array.isArray(rawStats)) {
    for (const row of rawStats) {
      if (Array.isArray(row)) {
        const labelCandidate = row.find((item) => typeof item === 'string' && statKeyFromLabel(item))
        if (labelCandidate) rows.push({ label: labelCandidate, value: row })
        continue
      }

      if (row && typeof row === 'object') {
        const record = row as Record<string, unknown>
        const label = record.label ?? record.name ?? record.stat ?? record.statName ?? record.stat_name
        if (label) rows.push({ label, value: row })
      }
    }
  }

  for (const row of rows) {
    const key = statKeyFromLabel(row.label)
    if (!key) continue

    const pair = extractStatPair(row.value)
    if (!pair) continue

    normalizedStats[key] = pair
  }

  return normalizedStats
}

function swapStats(stats: NormalizedStats): NormalizedStats {
  const swapped = emptyStats()

  for (const { key } of STAT_DEFINITIONS) {
    swapped[key] = {
      home: stats[key].away,
      away: stats[key].home,
    }
  }

  return swapped
}

function missingStats(stats: NormalizedStats) {
  return STAT_DEFINITIONS
    .filter(({ key }) => stats[key].home === null || stats[key].away === null)
    .map(({ key }) => key)
}

function getFormString(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const value = formData.get(key)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return undefined
}

function findTeamIdForOcr(ocrName: unknown, mappings: Array<{ ocr_name: string | null; team_id: string | null }>) {
  const ocrNormalized = normalizeForMatching(ocrName)
  if (!ocrNormalized) return undefined

  let bestMatch: { teamId: string; score: number } | null = null

  for (const mapping of mappings) {
    if (!mapping.ocr_name || !mapping.team_id) continue

    const mappingNormalized = normalizeForMatching(mapping.ocr_name)
    if (mappingNormalized.length < 3) continue

    const isMatch =
      ocrNormalized.includes(mappingNormalized) || mappingNormalized.includes(ocrNormalized)

    if (!isMatch) continue

    const score = Math.min(ocrNormalized.length, mappingNormalized.length)
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { teamId: mapping.team_id, score }
    }
  }

  return bestMatch?.teamId
}

function getFixtureId(formData: FormData) {
  return getFormString(formData, [
    'fixtureId',
    'fixture_id',
    'matchId',
    'match_id',
    'matchroomId',
    'matchroom_id',
    'gameId',
    'game_id',
  ])
}

function rowValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return undefined
}

function fixtureFromRow(row: Record<string, unknown>, source: 'formData' | 'database', table?: string): FixtureContext | null {
  const homeTeamId = rowValue(row, [
    'home_team_id',
    'homeTeamId',
    'home_team',
    'homeTeam',
    'home_id',
    'homeId',
    'team_home_id',
  ])

  const awayTeamId = rowValue(row, [
    'away_team_id',
    'awayTeamId',
    'away_team',
    'awayTeam',
    'away_id',
    'awayId',
    'team_away_id',
  ])

  if (!homeTeamId && !awayTeamId) return null

  return {
    source,
    homeTeamId,
    awayTeamId,
    table,
  }
}

async function loadFixtureContext(adminSupabase: AdminSupabase, formData: FormData): Promise<FixtureContext> {
  const formHomeTeamId = getFormString(formData, ['expectedHomeTeamId', 'homeTeamId', 'home_team_id'])
  const formAwayTeamId = getFormString(formData, ['expectedAwayTeamId', 'awayTeamId', 'away_team_id'])

  if (formHomeTeamId || formAwayTeamId) {
    return {
      source: 'formData',
      fixtureId: getFixtureId(formData),
      homeTeamId: formHomeTeamId,
      awayTeamId: formAwayTeamId,
    }
  }

  const fixtureId = getFixtureId(formData)
  if (!fixtureId) return { source: 'none' }

  const tableAttempts = [
    {
      table: 'matches',
      select: 'id, home_team_id, away_team_id',
    },
    {
      table: 'fixtures',
      select: 'id, home_team_id, away_team_id',
    },
    {
      table: 'match_rooms',
      select: 'id, home_team_id, away_team_id',
    },
    {
      table: 'matchrooms',
      select: 'id, home_team_id, away_team_id',
    },
    {
      table: 'matches',
      select: 'id, homeTeamId, awayTeamId',
    },
    {
      table: 'fixtures',
      select: 'id, homeTeamId, awayTeamId',
    },
  ]

  for (const attempt of tableAttempts) {
    const { data, error } = await adminSupabase
      .from(attempt.table)
      .select(attempt.select)
      .eq('id', fixtureId)
      .maybeSingle()

    if (error || !data) continue

    const fixture = fixtureFromRow(data as Record<string, unknown>, 'database', attempt.table)
    if (fixture) return { ...fixture, fixtureId }
  }

  return { source: 'none', fixtureId }
}

function shouldSwapSides(mappings: TeamMappings, fixture: FixtureContext) {
  const screenshotHomeTeamId = mappings.home
  const screenshotAwayTeamId = mappings.away
  const appHomeTeamId = fixture.homeTeamId
  const appAwayTeamId = fixture.awayTeamId

  if (!appHomeTeamId && !appAwayTeamId) {
    return {
      swapped: false,
      reason: 'No expected home/away team ids were provided, so screenshot order was kept.',
    }
  }

  if (appHomeTeamId && screenshotAwayTeamId === appHomeTeamId) {
    return {
      swapped: true,
      reason: 'Screenshot away team matches the app home team, so scores and stats were swapped into app home/away order.',
    }
  }

  if (appAwayTeamId && screenshotHomeTeamId === appAwayTeamId) {
    return {
      swapped: true,
      reason: 'Screenshot home team matches the app away team, so scores and stats were swapped into app home/away order.',
    }
  }

  return {
    swapped: false,
    reason: 'Screenshot team order already matches the app fixture order, or there was not enough mapped team data to swap safely.',
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('screenshot')

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: 'screenshot file is required' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let parsed: ParsedScreenshotLike
  try {
    parsed = (await parseScreenshot(buffer)) as ParsedScreenshotLike
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OCR failed'
    return Response.json({ error: message }, { status: 500 })
  }

  const adminSupabase = await createAdminClient()

  // Look up team_name_mappings for auto-resolution
  const { data: mappings } = await adminSupabase
    .from('team_name_mappings')
    .select('ocr_name, team_id')

  const mappingRows = (mappings ?? []) as Array<{ ocr_name: string | null; team_id: string | null }>

  const screenshotMappings: TeamMappings = {
    home: findTeamIdForOcr(parsed.homeTeamOcr, mappingRows),
    away: findTeamIdForOcr(parsed.awayTeamOcr, mappingRows),
  }

  const fixture = await loadFixtureContext(adminSupabase, formData)
  const normalizedStats = normalizeStats(parsed.stats)
  const swapDecision = shouldSwapSides(screenshotMappings, fixture)

  const screenshotHomeScore = toNumber(parsed.homeScore)
  const screenshotAwayScore = toNumber(parsed.awayScore)
  const matchStatus = parsed.matchStatus ?? parsed.status ?? null

  const homeTeamOcr = swapDecision.swapped ? parsed.awayTeamOcr : parsed.homeTeamOcr
  const awayTeamOcr = swapDecision.swapped ? parsed.homeTeamOcr : parsed.awayTeamOcr
  const homeScore = swapDecision.swapped ? screenshotAwayScore : screenshotHomeScore
  const awayScore = swapDecision.swapped ? screenshotHomeScore : screenshotAwayScore
  const stats = swapDecision.swapped ? swapStats(normalizedStats) : normalizedStats
  const resolvedMappings: TeamMappings = swapDecision.swapped
    ? { home: screenshotMappings.away, away: screenshotMappings.home }
    : screenshotMappings

  return Response.json({
    homeTeamOcr,
    awayTeamOcr,
    homeScore,
    awayScore,
    matchStatus,
    stats,
    mappings: resolvedMappings,
    missingStats: missingStats(stats),
    sideMapping: {
      swapped: swapDecision.swapped,
      reason: swapDecision.reason,
      fixture,
      screenshot: {
        homeTeamOcr: parsed.homeTeamOcr,
        awayTeamOcr: parsed.awayTeamOcr,
        homeTeamId: screenshotMappings.home ?? null,
        awayTeamId: screenshotMappings.away ?? null,
      },
    },
    originalScreenshotSides: {
      homeTeamOcr: parsed.homeTeamOcr,
      awayTeamOcr: parsed.awayTeamOcr,
      homeScore: screenshotHomeScore,
      awayScore: screenshotAwayScore,
      stats: normalizedStats,
      mappings: screenshotMappings,
    },
  })
}
