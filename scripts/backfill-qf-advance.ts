/**
 * One-off: fill the QF (matchday 101-104) team slots of the International Cup
 * knockout bracket from the confirmed R16 results, mirroring the app's
 * single-leg BRACKET_PROGRESSION logic (lib/tournament-progression.ts).
 *
 * WHY: The 8 R16 results were confirmed but progression to the QF fixtures was
 * never run, so QF home/away team ids are still null (TBC).
 *
 * Single-leg mapping used:
 *   51 -> 101 home | 52 -> 101 away | 53 -> 102 home | 54 -> 102 away
 *   55 -> 103 home | 56 -> 103 away | 57 -> 104 home | 58 -> 104 away
 *
 * Winner is decided by score: higher score advances; a draw advances nobody.
 *
 * Run: npx tsx scripts/backfill-qf-advance.ts
 */
import { loadEnvFile } from 'process'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

try { loadEnvFile('.env.local') } catch {}
try { loadEnvFile('.env.supabase') } catch {}

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

const TOURNAMENT_ID = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'

const BRACKET_PROGRESSION: Record<number, { nextMd: number; slot: 'home_team_id' | 'away_team_id' }> = {
  51: { nextMd: 101, slot: 'home_team_id' },
  52: { nextMd: 101, slot: 'away_team_id' },
  53: { nextMd: 102, slot: 'home_team_id' },
  54: { nextMd: 102, slot: 'away_team_id' },
  55: { nextMd: 103, slot: 'home_team_id' },
  56: { nextMd: 103, slot: 'away_team_id' },
  57: { nextMd: 104, slot: 'home_team_id' },
  58: { nextMd: 104, slot: 'away_team_id' },
}

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: r16, error: r16Error } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, status, home_team_id, away_team_id,
      results(home_score, away_score),
      home_team:teams!fixtures_home_team_id_fkey(name),
      away_team:teams!fixtures_away_team_id_fkey(name)
    `)
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('round_type', 'r16')
    .in('matchday', [51, 52, 53, 54, 55, 56, 57, 58])

  if (r16Error || !r16) throw new Error(`R16 fetch failed: ${r16Error?.message}`)

  const qfByMd: Record<number, { id: string; [slot: string]: string }> = {}
  const { data: qf, error: qfError } = await supabase
    .from('fixtures')
    .select('id, matchday')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('round_type', 'qf')
    .in('matchday', [101, 102, 103, 104])
  if (qfError || !qf) throw new Error(`QF fetch failed: ${qfError?.message}`)
  for (const fx of qf) qfByMd[fx.matchday] = { id: fx.id }

  let advanced = 0
  const skipped: string[] = []

  for (const fx of r16) {
    const mapping = BRACKET_PROGRESSION[fx.matchday]
    if (!mapping) {
      skipped.push(`MD${fx.matchday}: no progression mapping`)
      continue
    }
    if (fx.status !== 'confirmed') {
      skipped.push(`MD${fx.matchday}: status ${fx.status}`)
      continue
    }

    const result = Array.isArray(fx.results) ? fx.results[0] : fx.results
    if (!result) {
      skipped.push(`MD${fx.matchday}: no result row`)
      continue
    }

    const home = Array.isArray(fx.home_team) ? fx.home_team?.[0] : fx.home_team
    const away = Array.isArray(fx.away_team) ? fx.away_team?.[0] : fx.away_team

    const winnerId =
      result.home_score > result.away_score ? fx.home_team_id
      : result.away_score > result.home_score ? fx.away_team_id
      : null

    if (!winnerId) {
      skipped.push(`MD${fx.matchday}: drawn fixture, no winner`)
      continue
    }

    const target = qfByMd[mapping.nextMd]
    if (!target) {
      skipped.push(`MD${fx.matchday}: QF ${mapping.nextMd} not found`)
      continue
    }

    const { error: updError } = await supabase
      .from('fixtures')
      .update({ [mapping.slot]: winnerId })
      .eq('id', target.id)

    if (updError) {
      skipped.push(`MD${fx.matchday} -> QF ${mapping.nextMd}: ${updError.message}`)
      continue
    }

    const winnerName = result.home_score > result.away_score ? home?.name : away?.name
    console.log(
      `MD${fx.matchday} ${home?.name} ${result.home_score}-${result.away_score} ${away?.name} -> QF ${mapping.nextMd} ${mapping.slot} = ${winnerName}`
    )
    advanced++
  }

  console.log(`\nAdvanced: ${advanced} winner(s). Skipped: ${skipped.length}`)
  for (const s of skipped) console.log(`  - ${s}`)

  const { data: qfAfter } = await supabase
    .from('fixtures')
    .select(`
      matchday,
      home_team:teams!fixtures_home_team_id_fkey(name),
      away_team:teams!fixtures_away_team_id_fkey(name)
    `)
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('round_type', 'qf')
    .order('matchday')
  for (const fx of qfAfter ?? []) {
    const h = Array.isArray(fx.home_team) ? fx.home_team?.[0] : fx.home_team
    const a = Array.isArray(fx.away_team) ? fx.away_team?.[0] : fx.away_team
    console.log(`QF ${fx.matchday}: ${h?.name ?? 'TBC'} vs ${a?.name ?? 'TBC'}`)
  }
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})