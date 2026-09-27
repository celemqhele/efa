/**
 * Creates Season 4 with two 16-team divisions, two CAF club competitions, a
 * 32-team Nedbank Cup and the CAF Super Cup shell.
 *
 * Everything is written through the same helpers the admin UI uses
 * (generateLeagueFixtures / generateGroupFixtures / drawGroups /
 * generateTBCKnockouts / stampFixtureParticipants) so scheduling limits, seeded
 * draws and participant stamping behave exactly as they do in the app.
 *
 * Idempotent: aborts if a season named "Season 4" already exists.
 *
 * Run: npx tsx scripts/create-season4.ts
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'process'
import { addDays, format } from 'date-fns'
import { generateGroupFixtures, generateLeagueFixtures } from '@/lib/fixture-generator'
import { drawGroups } from '@/lib/tournament-draw'
import { generateTBCKnockouts } from '@/lib/tournament-progression'
import { stampFixtureParticipants } from '@/lib/slot-utils'

try {
  loadEnvFile('.env.local')
} catch {
  /* fall back to process env */
}
try {
  loadEnvFile('.env.supabase')
} catch {
  /* no .env.supabase */
}
// No env file in this repo actually holds NEXT_PUBLIC_SUPABASE_URL (all of them
// ship it empty) and loadEnvFile never overrides an existing key. The DB
// connection string points at the Supavisor pooler host, which does not contain
// the project ref either, so read `ref` out of the service-role JWT instead:
// {"iss":"supabase","ref":"<project-ref>",...}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const payload = process.env.SUPABASE_SERVICE_ROLE_KEY.split('.')[1]
    const ref = (JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as any).ref
    if (typeof ref === 'string' && ref.length > 0) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${ref}.supabase.co`
    }
  } catch {
    /* leave unset */
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
// The standings/slot helpers read these via createAdminClient() internally.
process.env.SUPABASE_SERVICE_ROLE_KEY = key

const db = createClient(supabaseUrl, key) as any

const SEASON_NAME = 'Season 4'
const START_DATE = '2026-09-28'
const NUM_ROUNDS = 2

// Division 1 = top 16 on career PPG (PPG desc, then GD, then GF).
const DIV1_USERNAMES = [
  'Terrence', 'minenhle22', 'uvesh', 'itumeleng_99',
  'amow', 'phiwayinkosi', 'tildedot', 'wandile',
  'vuyo', 'calvin', 'jobe', 'loki',
  'whitey', 'anele_arh', 'siyethemba_', 'badbouycee',
]

// Division 2 = the remaining 13 career-ranked managers, then the three vacant
// Motsepe Foundation Championship clubs (no manager).
const DIV2_USERNAMES = [
  'jigsaw_rsa', 'goat_2', 'celemqhele', 'parmalat_', 'm_a_s_h_a_u', 'hlabaking103',
  'loneprsly', 'lorne23', 'hunger_', 'ourfather_22', 'dimarco_32', 'ozilotf_', 'wamashudu',
]
const DIV2_VACANT_SLUGS = ['leicesterford-city', 'lerumo-lions', 'upington-city']

const MFC_FOLDER = 'motsepe-foundation-championship-2026-2027.football-logos.cc'

interface Slot { user_id: string | null; team_id: string }

function fail(msg: string): never {
  console.error(`\nABORT: ${msg}`)
  process.exit(1)
}

async function resolveSlotsByUsername(usernames: string[]): Promise<Slot[]> {
  const slots: Slot[] = []
  for (const username of usernames) {
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (!profile) fail(`manager "${username}" not found`)

    const { data: team } = await db
      .from('teams')
      .select('id')
      .eq('manager_id', profile.id)
      .maybeSingle()
    if (!team) fail(`manager "${username}" has no club`)

    slots.push({ user_id: profile.id, team_id: team.id })
  }
  return slots
}

async function resolveVacantBySlug(slugs: string[]): Promise<Slot[]> {
  const slots: Slot[] = []
  for (const slug of slugs) {
    const { data: team } = await db
      .from('teams')
      .select('id')
      .eq('logo_team_slug', slug)
      .eq('logo_league_folder', MFC_FOLDER)
      .is('manager_id', null)
      .maybeSingle()
    if (!team) fail(`vacant club "${slug}" not found or already has a manager`)
    slots.push({ user_id: null, team_id: team.id })
  }
  return slots
}

/** Creates a league tournament, its participants, zeroed standings and fixtures. */
async function createLeague(opts: {
  seasonId: string
  name: string
  division: number
  zones: Record<string, number>
  slots: Slot[]
}): Promise<{ id: string; fixtures: number; endDate: string }> {
  const { seasonId, name, division, zones, slots } = opts
  const teamIds = slots.map((s) => s.team_id)

  const { data: tournament, error } = await db
    .from('tournaments')
    .insert({
      season_id: seasonId,
      name,
      type: 'league',
      division,
      status: 'active',
      settings: {
        start_date: START_DATE,
        end_date: null,
        fixture_mode: 'round_robin',
        num_rounds: NUM_ROUNDS,
        division,
        standings_zones: zones,
      },
    })
    .select('id')
    .single()
  if (error || !tournament) fail(`could not create ${name}: ${error?.message}`)

  const { data: inserted, error: pErr } = await db
    .from('tournament_participants')
    .insert(slots.map((s) => ({ tournament_id: tournament.id, team_id: s.team_id, user_id: s.user_id })))
    .select('id, team_id')
  if (pErr) fail(`could not add ${name} participants: ${pErr.message}`)

  const participantByTeam = new Map<string, string>()
  for (const row of inserted ?? []) participantByTeam.set(row.team_id, row.id)

  const { error: sErr } = await db.from('standings').insert(
    teamIds.map((team_id) => ({
      tournament_id: tournament.id,
      team_id,
      participant_id: participantByTeam.get(team_id) ?? null,
      played: 0, wins: 0, draws: 0, losses: 0,
      goals_for: 0, goals_against: 0, points: 0,
      form: '', unbeaten_run: 0, clean_sheets: 0,
    }))
  )
  if (sErr) fail(`could not seed ${name} standings: ${sErr.message}`)

  const generated = await generateLeagueFixtures(db, teamIds, tournament.id, NUM_ROUNDS, START_DATE)
  if (generated.length > 0) {
    const stamped = await stampFixtureParticipants(db, tournament.id, generated)
    const { error: fErr } = await db.from('fixtures').insert(
      stamped.map((f) => ({
        tournament_id: tournament.id,
        home_team_id: f.home_team_id,
        away_team_id: f.away_team_id,
        home_participant_id: f.home_participant_id,
        away_participant_id: f.away_participant_id,
        matchday: f.matchday,
        scheduled_date: f.scheduled_date,
        deadline: f.deadline,
        round_type: f.round_type,
        leg: f.leg,
        status: 'scheduled',
        is_postponed: false,
      }))
    )
    if (fErr) fail(`could not insert ${name} fixtures: ${fErr.message}`)
  }

  const lastDate = generated.reduce((max, f) => (f.scheduled_date > max ? f.scheduled_date : max), START_DATE)
  return { id: tournament.id, fixtures: generated.length, endDate: lastDate }
}

/** Creates a CAF competition: seeded 4x4 draw, group standings and group fixtures. */
async function createCafCup(opts: {
  seasonId: string
  name: string
  slots: Slot[]
  startFrom: string
  numGroups?: number
  qualifiersPerGroup?: number
}): Promise<{ id: string; fixtures: number; endDate: string }> {
  const { seasonId, name, slots, startFrom } = opts
  const numGroups = opts.numGroups ?? 4
  const qualifiersPerGroup = opts.qualifiersPerGroup ?? 1
  const teamIds = slots.map((s) => s.team_id)

  const { data: tournament, error } = await db
    .from('tournaments')
    .insert({
      season_id: seasonId,
      name,
      type: 'tournament_club',
      status: 'active',
      settings: {
        start_date: startFrom,
        end_date: null,
        fixture_mode: 'groups',
        num_groups: numGroups,
        num_rounds: NUM_ROUNDS,
        qualifiers_per_group: qualifiersPerGroup,
        // Flags the two continental competitions so the auto Super Cup picks this
        // pair rather than "the first two tournament_club rows" (Season 4 also
        // runs the Nedbank Cup, which is not continental).
        is_continental: true,
        super_cup_name: 'CAF Super Cup',
      },
    })
    .select('id')
    .single()
  if (error || !tournament) fail(`could not create ${name}: ${error?.message}`)

  const { data: inserted, error: pErr } = await db
    .from('tournament_participants')
    .insert(slots.map((s) => ({ tournament_id: tournament.id, team_id: s.team_id, user_id: s.user_id })))
    .select('id, team_id')
  if (pErr) fail(`could not add ${name} participants: ${pErr.message}`)

  const participantByTeam = new Map<string, string>()
  for (const row of inserted ?? []) participantByTeam.set(row.team_id, row.id)

  // Seeded draw: league finish order sets the pot.
  const draw = drawGroups({
    teams: teamIds.map((id, idx) => ({ id, rank: idx + 1, label: '' })),
    groupCount: numGroups,
  })
  if (!draw.valid) fail(`${name} draw failed to produce a valid grouping`)

  const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const groups = new Map<number, string[]>()
  for (const a of draw.groups) {
    if (!groups.has(a.group)) groups.set(a.group, [])
    groups.get(a.group)!.push(a.teamId)
  }

  for (const a of draw.groups) {
    await db
      .from('tournament_participants')
      .update({ group_name: groupNames[a.group] ?? `Group ${a.group + 1}`, seed_pot: a.pot })
      .eq('tournament_id', tournament.id)
      .eq('team_id', a.teamId)
  }

  const allGroups: Record<string, string[]> = {}
  for (const [groupIdx, groupTeamIds] of groups) {
    const groupName = groupNames[groupIdx] ?? `Group ${groupIdx + 1}`
    allGroups[groupName] = groupTeamIds

    for (const teamId of groupTeamIds) {
      const { error: gErr } = await db.from('group_standings').upsert(
        {
          tournament_id: tournament.id,
          group_name: groupName,
          team_id: teamId,
          participant_id: participantByTeam.get(teamId) ?? null,
          played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0, points: 0,
        },
        { onConflict: 'tournament_id,group_name,participant_id' }
      )
      if (gErr) fail(`could not seed ${name} group ${groupName}: ${gErr.message}`)
    }
  }

  const generated = await generateGroupFixtures(db, allGroups, NUM_ROUNDS, startFrom, tournament.id)
  if (generated.length > 0) {
    const stamped = await stampFixtureParticipants(db, tournament.id, generated)
    const { error: fErr } = await db.from('fixtures').insert(
      stamped.map((f) => ({
        tournament_id: tournament.id,
        home_team_id: f.home_team_id,
        away_team_id: f.away_team_id,
        home_participant_id: f.home_participant_id,
        away_participant_id: f.away_participant_id,
        matchday: f.matchday,
        scheduled_date: f.scheduled_date,
        deadline: f.deadline,
        round_type: f.round_type,
        leg: f.leg,
        status: 'scheduled',
        is_postponed: false,
      }))
    )
    if (fErr) fail(`could not insert ${name} fixtures: ${fErr.message}`)
  }

  const lastDate = generated.reduce((max, f) => (f.scheduled_date > max ? f.scheduled_date : max), startFrom)
  return { id: tournament.id, fixtures: generated.length, endDate: lastDate }
}

async function main() {
  const { data: existing } = await db.from('seasons').select('id, name').eq('name', SEASON_NAME).maybeSingle()
  if (existing) fail(`season "${SEASON_NAME}" already exists (${existing.id}) — nothing to do`)

  const div1Slots = await resolveSlotsByUsername(DIV1_USERNAMES)
  const div2Slots = [
    ...(await resolveSlotsByUsername(DIV2_USERNAMES)),
    ...(await resolveVacantBySlug(DIV2_VACANT_SLUGS)),
  ]

  const overlap = new Set(div1Slots.map((s) => s.team_id))
  const clash = div2Slots.find((s) => overlap.has(s.team_id))
  if (clash) fail(`club ${clash.team_id} appears in both divisions`)
  if (div1Slots.length !== 16) fail(`division 1 has ${div1Slots.length} clubs, expected 16`)
  if (div2Slots.length !== 16) fail(`division 2 has ${div2Slots.length} clubs, expected 16`)

  console.log('Roster resolved: 16 + 16')

  const { data: season, error: seasonErr } = await db
    .from('seasons')
    .insert({
      name: SEASON_NAME,
      base_league: 'Betway Premiership',
      status: 'active',
      start_date: START_DATE,
      end_date: null,
    })
    .select('id')
    .single()
  if (seasonErr || !season) fail(`could not create season: ${seasonErr?.message}`)
  const seasonId = season.id
  console.log(`Season created: ${SEASON_NAME} (${seasonId})`)

  const d1 = await createLeague({
    seasonId,
    name: 'Betway Premiership',
    division: 1,
    zones: { bottom_yellow: 2, bottom_red: 3 },
    slots: div1Slots,
  })
  console.log(`Betway Premiership: ${d1.fixtures} fixtures (to ${d1.endDate})`)

  const d2 = await createLeague({
    seasonId,
    name: 'Motsepe Foundation Championship',
    division: 2,
    zones: { top_green: 3, top_yellow: 2 },
    slots: div2Slots,
  })
  console.log(`Motsepe Foundation Championship: ${d2.fixtures} fixtures (to ${d2.endDate})`)

  // Cups begin the day after the last league fixture.
  const cupStart = format(addDays(new Date(d1.endDate > d2.endDate ? d1.endDate : d2.endDate), 1), 'yyyy-MM-dd')

  const cl = await createCafCup({
    seasonId,
    name: 'CAF Champions League',
    slots: div1Slots,
    startFrom: cupStart,
  })
  console.log(`CAF Champions League: ${cl.fixtures} group fixtures (from ${cupStart})`)

  const ccl = await createCafCup({
    seasonId,
    name: 'CAF Confederations League',
    slots: div2Slots,
    startFrom: cupStart,
  })
  console.log(`CAF Confederations League: ${ccl.fixtures} group fixtures (from ${cupStart})`)

  // Nedbank Cup: straight 32-team single-leg knockout, all clubs eligible.
  const allSlots = [...div1Slots, ...div2Slots]
  const { data: nedbank, error: nErr } = await db
    .from('tournaments')
    .insert({
      season_id: seasonId,
      name: 'Nedbank Cup',
      type: 'tournament_club',
      status: 'active',
      settings: {
        start_date: cupStart,
        end_date: null,
        fixture_mode: 'knockout',
        num_teams: 32,
        num_legs: 1,
      },
    })
    .select('id')
    .single()
  if (nErr || !nedbank) fail(`could not create Nedbank Cup: ${nErr?.message}`)

  const { error: npErr } = await db
    .from('tournament_participants')
    .insert(allSlots.map((s) => ({ tournament_id: nedbank.id, team_id: s.team_id, user_id: s.user_id })))
  if (npErr) fail(`could not add Nedbank Cup participants: ${npErr.message}`)

  // This tournament has no group stage, so assignKnockoutDates anchors the bracket
  // to the tournament's own settings.start_date (cupStart) rather than today.
  const { error: koErr } = await generateTBCKnockouts(db, nedbank.id, allSlots.map((s) => s.team_id), 1)
  if (koErr) fail(`could not generate Nedbank Cup bracket: ${koErr.message}`)

  const { data: nedbankFixtures } = await db
    .from('fixtures')
    .select('scheduled_date, round_type')
    .eq('tournament_id', nedbank.id)
    .order('scheduled_date', { ascending: true })
  const nedbankCount = nedbankFixtures?.length ?? 0
  const nedbankStart = nedbankFixtures?.[0]?.scheduled_date ?? cupStart
  const nedbankEnd = nedbankFixtures?.[nedbankCount - 1]?.scheduled_date ?? cupStart
  console.log(`Nedbank Cup: ${nedbankCount} fixtures (${nedbankStart} -> ${nedbankEnd})`)

  // Super Cup shell: no participants yet. checkAndCreateSuperCup in
  // lib/tournament-progression.ts adopts this shell once both CAF finals have
  // awarded trophies, and fills in the two winners.
  const { data: superCup, error: scErr } = await db
    .from('tournaments')
    .insert({
      season_id: seasonId,
      name: 'CAF Super Cup',
      type: 'friendlies',
      status: 'active',
      settings: { is_super_cup: true },
    })
    .select('id')
    .single()
  if (scErr || !superCup) fail(`could not create CAF Super Cup: ${scErr?.message}`)

  const { error: scFxErr } = await db.from('fixtures').insert({
    tournament_id: superCup.id,
    home_team_id: null,
    away_team_id: null,
    matchday: 1,
    round_type: 'super_cup',
    status: 'scheduled',
    scheduled_date: nedbankEnd,
    deadline: `${nedbankEnd}T20:00:00Z`,
  })
  if (scFxErr) fail(`could not create CAF Super Cup fixture: ${scFxErr.message}`)
  console.log(`CAF Super Cup: shell created, fixture placeholder on ${nedbankEnd}`)

  // Season end date follows the last scheduled fixture across every competition.
  const { data: allFixtures } = await db
    .from('fixtures')
    .select('scheduled_date')
    .in('tournament_id', [d1.id, d2.id, cl.id, ccl.id, nedbank.id, superCup.id])
    .order('scheduled_date', { ascending: false })
    .limit(1)
  const seasonEnd = allFixtures?.[0]?.scheduled_date ?? nedbankEnd

  await db.from('seasons').update({ end_date: seasonEnd }).eq('id', seasonId)
  for (const t of [d1, d2, cl, ccl]) {
    const { data: row } = await db.from('tournaments').select('settings').eq('id', t.id).single()
    await db.from('tournaments')
      .update({ settings: { ...(row?.settings ?? {}), end_date: t.endDate } })
      .eq('id', t.id)
  }
  await db.from('tournaments').update({ settings: { start_date: cupStart, end_date: nedbankEnd, fixture_mode: 'knockout', num_teams: 32, num_legs: 1 } }).eq('id', nedbank.id)

  const total = d1.fixtures + d2.fixtures + cl.fixtures + ccl.fixtures + nedbankCount + 1
  console.log(`\nSeason end date: ${seasonEnd}`)
  console.log(`Fixtures created: ${total}`)
  console.log('Note: CAF knockout brackets (13 fixtures each) are generated after the group stage via the admin Generate Knockouts action.')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
