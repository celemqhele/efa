/**
 * Two forfeit-balance repairs, both stemming from the same gap: a forfeit result
 * creates a carry-over balance, and resetting/correcting the result left the
 * balance behind.
 *
 * PART A - TS Galaxy vs Polokwane City should be a plain 3-0 win.
 *   The match was filed as a forfeit ("adjusted from 3-0" -> 6-0), which also
 *   created a 6-goal carry-over balance for matolo7 (Polokwane City). That
 *   balance was then consumed on Midlands Wanderers vs Polokwane City, pushing a
 *   genuine 8-4 win to 14-4. Both the +3 on the source score and the penalty on
 *   the next match are wrong: a no-show is a 3-0 win, not a 3-0 plus a forfeit.
 *   This script sets the source match to 3-0, drops its forfeit marker, deletes
 *   the balance it created, and trims the consuming result by the same 6 goals.
 *
 * PART B - Stale balances that survived an admin Reset Result.
 *   Supersport vs Milford (whatsapp_reset_count = 1) was reset by an admin but
 *   three forfeit balances it had created stayed on file, each still available
 *   (remaining = 1) - so Supersport's and Milford's managers would each have
 *   served the penalty again in a future match. The match is now an auto 0-0
 *   (not a forfeit), so those balances are no longer valid and are deleted.
 *   Also removes two historical duplicate balances for the same fixture +
 *   manager (the old submit path inserted a fresh row on every resubmission).
 *
 * Run: npx tsx scripts/fix-stale-forfeit-balances-2026-10-20.ts [--dry]
 */
import { loadEnvFile } from 'process'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { recalculateStandings } from '../lib/standings-engine'
import { voidBalancesCreatedBy } from '../lib/forfeit-balance-revert'

try {
  loadEnvFile('.env.local')
} catch {
  // fall back to process env
}
try {
  loadEnvFile('.env.supabase')
} catch {
  // optional
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!url) {
  const dbUrl = process.env.SUPABASE_DB_URL ?? ''
  const m = dbUrl.match(/^postgresql:\/\/postgres\.([^:]+):/)
  if (m) url = `https://${m[1]}.supabase.co`
}
if (!url || !key || key.length < 10) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
process.env.NEXT_PUBLIC_SUPABASE_URL = url

const dry = process.argv.includes('--dry')

// ── Part A ──────────────────────────────────────────────────────────────────
const GALAXY_FIXTURE = '5967ac6f-d9b3-4b61-85f2-d7e817d06b6d' // TS Galaxy vs Polokwane City
const MIDLANDS_FIXTURE = 'ccd8a349-dce5-4199-ae4a-6f347d4b640b' // Midlands Wanderers vs Polokwane City
const GALAXY_HOME = 3 // TS Galaxy
const GALAXY_AWAY = 0 // Polokwane City

// ── Part B ──────────────────────────────────────────────────────────────────
// Supersport vs Milford: reset once, current result is the auto 0-0, so every
// balance it created is stale.
const MILFORD_FIXTURE = '1b64f884-5012-4421-b008-2fb1b1eb0ffc'
// Historical duplicates (same fixture + manager, remaining 0): keep the newest,
// drop the rest.
const DUPLICATE_GROUPS: { fixture: string; manager: string; keep: string; drop: string[] }[] = [
  {
    fixture: '26c510bf-96f8-4a4d-9f35-fa15d2778581', // Bournemouth v Newcastle United
    manager: 'cc0040f7-19b9-46d2-9721-e162f6583467',
    keep: '4af41a10-dab9-49dd-bfcd-53c12455f377',
    drop: ['a016bd30-7862-42d9-b950-8419c5c04a0a'],
  },
  {
    fixture: 'a37bccb8-0b61-4170-8378-1c8c7a2b2c96', // Barcelona v Sporting Cp
    manager: 'b3fd612d-adb9-497d-b645-6b4b362d578f',
    keep: 'b7f82225-01e6-477c-b5dc-6b69eb1a8752',
    drop: ['6ab10578-c037-4378-8d56-1e7dc66582d4'],
  },
]

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const tournaments = new Set<string>()

  // ── Part A ──
  const { data: galaxyFixture } = await supabase
    .from('fixtures')
    .select('id, tournament_id, home_team_id, away_team_id')
    .eq('id', GALAXY_FIXTURE)
    .maybeSingle()
  if (!galaxyFixture) throw new Error('TS Galaxy fixture not found')

  console.log('[A] TS Galaxy vs Polokwane City -> 3-0, drop the forfeit balance')
  if (!dry) {
    const { error } = await supabase
      .from('results')
      .update({
        home_score: GALAXY_HOME,
        away_score: GALAXY_AWAY,
        is_abandoned: false,
        abandoned_type: null,
        override_reason: 'Walkover 3-0 (forfeit adjustment removed)',
      })
      .eq('fixture_id', GALAXY_FIXTURE)
    if (error) throw new Error(`Galaxy result update failed: ${error.message}`)

    const voided = await voidBalancesCreatedBy(supabase, GALAXY_FIXTURE)
    console.log(`    voided ${voided.voided} balance(s), adjusted ${voided.adjusted.length} consumer(s)`)
    for (const a of voided.adjusted) {
      console.log(`    ${a.fixtureId} -> ${a.homeScore}-${a.awayScore}`)
      if (a.tournamentId) tournaments.add(a.tournamentId)
    }
    if (voided.tournaments) for (const t of voided.tournaments) tournaments.add(t)
  }
  if (galaxyFixture.tournament_id) tournaments.add(String(galaxyFixture.tournament_id))

  // ── Part B1: Supersport vs Milford stale balances ──
  console.log('[B1] Supersport vs Milford: delete balances left behind by the reset')
  const { data: milestoneBalances } = await supabase
    .from('forfeit_balances')
    .select('id, remaining, consumed_by_fixture_id, forfeiting_manager_id')
    .eq('fixture_id', MILFORD_FIXTURE)
  for (const b of (milestoneBalances ?? []) as any[]) {
    if (b.consumed_by_fixture_id) {
      console.log(`    SKIP ${b.id} (consumed by ${b.consumed_by_fixture_id}) - needs manual review`)
      continue
    }
    console.log(`    delete ${b.id} (remaining ${b.remaining})`)
    if (!dry) {
      const { error } = await supabase.from('forfeit_balances').delete().eq('id', b.id)
      if (error) throw new Error(`balance delete failed: ${error.message}`)
    }
  }

  // ── Part B2: historical duplicates ──
  for (const g of DUPLICATE_GROUPS) {
    for (const id of g.drop) {
      const { data: row } = await supabase
        .from('forfeit_balances')
        .select('id, fixture_id, forfeiting_manager_id, remaining, consumed_by_fixture_id')
        .eq('id', id)
        .maybeSingle()
      if (!row) {
        console.log(`[B2] ${id} already gone`)
        continue
      }
      const matches = row.fixture_id === g.fixture && row.forfeiting_manager_id === g.manager
      console.log(`[B2] delete duplicate ${id} (fixture matches: ${matches}, remaining ${row.remaining})`)
      if (!dry) {
        if (row.consumed_by_fixture_id) throw new Error(`${id} is consumed - refusing to delete`)
        const { error } = await supabase.from('forfeit_balances').delete().eq('id', id)
        if (error) throw new Error(`duplicate delete failed: ${error.message}`)
      }
    }
  }

  // ── Recalculate affected standings ──
  for (const tid of tournaments) {
    console.log(`[recalc] ${tid}`)
    if (!dry) {
      const res = await recalculateStandings(tid)
      console.log(`    ${JSON.stringify(res)}`)
    }
  }

  console.log(dry ? 'DRY RUN complete' : 'Done.')
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
