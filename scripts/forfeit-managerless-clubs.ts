/**
 * Applies the managerless-club auto-forfeit rule to clubs that are already
 * managerless on the server, using the same helper the sack routes call
 * (forfeitUnmanagedClubSlots). Needed after a sack performed by an older build
 * (or any direct manager_id edit) left seats still stamped with the sacked
 * manager's user_id and no forfeits scheduled.
 *
 * What it does per club (see lib/slot-utils.ts for detail):
 *   1. every seat the club holds (by team_id, or vacated_from_team_id when a
 *      legacy vacating flow overwrote team_id with the Vacant placeholder)
 *      drops user_id but KEEPS the real club — the club is never relabelled
 *   2. standings / group_standings / not-yet-played fixtures are restamped back
 *      to the real club
 *   3. remaining fixtures are auto-decided 3-0 for the managerless side (0-0
 *      when both sides are managerless), for every round type including
 *      knockout; future-dated ones land as confirmed_pending and are confirmed
 *      by the flip-pending cron on matchday
 *   4. results already entered by a human (finalised_by set) are never touched
 *
 * Reversal is automatic: assigning a manager runs reclaimManagerSlots(), which
 * withdraws these forfeits (clearAutoForfeitResults).
 *
 * Usage:
 *   npx tsx scripts/forfeit-managerless-clubs.ts --dry-run
 *   npx tsx scripts/forfeit-managerless-clubs.ts --club "Orlando Pirates" --club "Milford"
 *   npx tsx scripts/forfeit-managerless-clubs.ts --team-id <uuid> --team-id <uuid>
 *
 *   --club <name>     resolve a club by team name (siblings included)
 *   --team-id <uuid>  resolve a club by team id (siblings included)
 *   --dry-run         report what would change, write nothing
 *
 * With no selector, every MANAGERLESS real club (not the Vacant placeholder)
 * that holds at least one tournament seat is processed.
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'process'
import { forfeitUnmanagedClubSlots, isVacantPlaceholderTeam } from '@/lib/slot-utils'

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
// No env file carries NEXT_PUBLIC_SUPABASE_URL; derive it from the service-role
// JWT's ref, same trick as scripts/assign-manager-to-club.ts.
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

const db = createClient(supabaseUrl, key) as any

function argAll(name: string): string[] {
  return process.argv.flatMap((a, i) => (a === `--${name}` ? [process.argv[i + 1] ?? ''] : []))
}
const flag = (name: string) => process.argv.includes(`--${name}`)

function must(res: { error: { message: string } | null } | null, what: string): void {
  if (res?.error) throw new Error(`${what} failed: ${res.error.message}`)
}

/** All team rows sharing a club's logo, exactly as the sack routes collect them. */
async function clubRowIds(seedId: string): Promise<string[]> {
  const { data: team } = await db
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .eq('id', seedId)
    .single()
  if (!team) return []
  let ids = [team.id]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await db
      .from('teams')
      .select('id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', team.id)
    ids = [team.id, ...(siblings ?? []).map((s: any) => s.id as string)]
  }
  return ids
}

async function main() {
  const dryRun = flag('dry-run')
  const clubNames = argAll('club').filter(Boolean)
  const teamIds = argAll('team-id').filter(Boolean)

  const seeds: { id: string; label: string }[] = []

  for (const name of clubNames) {
    const { data: team } = await db
      .from('teams')
      .select('id, name, logo_league_folder, logo_team_slug')
      .eq('name', name)
      .limit(1)
      .maybeSingle()
    if (!team) {
      console.error(`✗ club '${name}' not found`)
      process.exit(1)
    }
    if (isVacantPlaceholderTeam(team)) {
      console.error(`✗ '${name}' is the Vacant placeholder — nothing to forfeit.`)
      process.exit(1)
    }
    seeds.push({ id: team.id, label: team.name })
  }

  for (const id of teamIds) {
    const { data: team } = await db
      .from('teams')
      .select('id, name, logo_league_folder, logo_team_slug')
      .eq('id', id)
      .maybeSingle()
    if (!team) {
      console.error(`✗ team id '${id}' not found`)
      process.exit(1)
    }
    if (isVacantPlaceholderTeam(team)) {
      console.error(`✗ '${team.name}' is the Vacant placeholder — nothing to forfeit.`)
      process.exit(1)
    }
    seeds.push({ id: team.id, label: team.name })
  }

  // No selector: every managerless real club holding a seat.
  if (seeds.length === 0) {
    const { data: unowned } = await db
      .from('tournament_participants')
      .select('team_id')
      .not('team_id', 'is', null)
    const candidateIds = [...new Set((unowned ?? []).map((r: any) => r.team_id as string))]
    if (candidateIds.length === 0) {
      console.log('No seats with a club attached — nothing to do.')
      return
    }
    const { data: clubs } = await db
      .from('teams')
      .select('id, name, manager_id, logo_league_folder, logo_team_slug')
      .in('id', candidateIds)
      .is('manager_id', null)
    for (const c of (clubs ?? []) as any[]) {
      if (isVacantPlaceholderTeam(c)) continue
      seeds.push({ id: c.id, label: c.name })
    }
    if (seeds.length === 0) {
      console.log('No managerless real clubs hold a seat — nothing to do.')
      return
    }
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}processing ${seeds.length} club(s): ${seeds.map((s) => s.label).join(', ')}`)

  for (const seed of seeds) {
    const allClubIds = await clubRowIds(seed.id)

    const { data: seats, error: seatsErr } = await db
      .from('tournament_participants')
      .select('id, tournament_id, team_id, user_id')
      .or(allClubIds.map((id) => `team_id.eq.${id},vacated_from_team_id.eq.${id}`).join(','))
    must(seatsErr, `reading seats for ${seed.label}`)
    const seatRows = (seats ?? []) as any[]
    if (seatRows.length === 0) {
      console.log(`  - ${seed.label}: no seats, skipped`)
      continue
    }

    const stale = seatRows.filter((s) => s.user_id !== null).length
    const seatIds = seatRows.map((s) => s.id)

    const { data: fixtures, error: fixturesErr } = await db
      .from('fixtures')
      .select('id, round_type, scheduled_date, status, results(finalised_by)')
      .or(seatIds.map((id) => `home_participant_id.eq.${id},away_participant_id.eq.${id}`).join(','))
      .in('status', ['scheduled', 'confirmed_pending'])
      .not('scheduled_date', 'is', null)
    must(fixturesErr, `reading fixtures for ${seed.label}`)

    const pending = (fixtures ?? []) as any[]
    const alreadyFinalised = pending.filter((f) => {
      const r = Array.isArray(f.results) ? f.results[0] : f.results
      return r && r.finalised_by
    }).length
    const byRound: Record<string, number> = {}
    for (const f of pending) byRound[f.round_type] = (byRound[f.round_type] ?? 0) + 1

    console.log(
      `  - ${seed.label}: ${seatRows.length} seat(s) (${stale} still owned by a sacked manager), ` +
      `${pending.length} remaining fixture(s) ${JSON.stringify(byRound)}` +
      (alreadyFinalised ? `, ${alreadyFinalised} with a human result (never touched)` : '')
    )

    if (dryRun) continue

    const result = await forfeitUnmanagedClubSlots(db, allClubIds)
    if (result.forfeits === 0 && stale === 0) {
      console.log(`      → no change (seats ${result.seats}, forfeits ${result.forfeits})`)
    } else {
      console.log(`      ✓ seats ${result.seats}, forfeits scheduled ${result.forfeits}`)
    }
  }

  if (dryRun) console.log('[dry-run] nothing was written.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
