/**
 * One-off repair (2026-10-16): clear the postponement "limbo" left by the old
 * rules, and re-apply the new postponement rules to the rows that already exist.
 *
 * Background
 * ----------
 * Before this change the daily auto-finalise cron SKIPPED any fixture that had a
 * 'pending' postponement request, and there was no hourly expire cron, so a
 * request that nobody answered left its fixture un-finalised forever. Four
 * requests are now long past the new POSTPONE_RESPONSE_HOURS (24h) window.
 *
 * What this script does
 * ---------------------
 * PART 1 - apply the 24h auto-decline rule to the existing pending requests
 *   (exactly what /api/cron/expire-postpone-requests does): decline every
 *   pending request older than 24h, notify the requester, and audit-log it.
 *
 * PART 2 - resolve the one game that was genuinely stuck:
 *   Supersport (home, anele_arh) vs Highbury (away, whitey), scheduled
 *   2026-10-12, still 'scheduled' with no result. Decision (user, 2026-10-16):
 *   the late not-responding report Highbury filed on Oct 15 is dismissed and the
 *   game is finalised 0-0 (both absent, no points) - the same outcome the
 *   auto-finalise cron produces when a fixture has no pending report. This
 *   mirrors finaliseZeroZero() in app/api/cron/auto-finalise-prev-day/route.ts.
 *
 * Idempotent: the declines no-op once done, and PART 2 bails if the fixture
 * already has a result.
 *
 * Run: npx tsx scripts/resolve-postpone-limbo-2026-10-16.ts
 */
import { loadEnvFile } from 'process'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Mirror lib/submit-match.ts so behaviour matches the app exactly.
const POSTPONE_RESPONSE_HOURS = 24
const APP_BASE = 'https://efa-fxyk.vercel.app'

const LIMBO_FIXTURE = '23cbb384-cdc4-4dae-bd5d-8dd8f1aaddec' // Supersport vs Highbury
const LIMBO_TOURNAMENT = '18d4f540-0246-42ae-8699-64d13d0a2ae7' // Betway Premiership

function labelDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

function teamName(t: any): string | null {
  if (Array.isArray(t)) return t[0]?.name ?? null
  return t?.name ?? null
}

function teamManagerId(t: any): string | null {
  if (Array.isArray(t)) return t[0]?.manager_id ?? null
  return t?.manager_id ?? null
}

async function main() {
  const notify = await import('../lib/notify.ts')

  // ── PART 1: decline every pending request older than 24h ──────────────────
  const cutoff = new Date(Date.now() - POSTPONE_RESPONSE_HOURS * 60 * 60 * 1000).toISOString()
  const { data: stale, error: staleErr } = await supabase
    .from('postpone_requests')
    .select('id, fixture_id, requested_by, new_date, created_at')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
  if (staleErr) throw new Error(`stale pending select failed: ${staleErr.message}`)

  const rows = (stale ?? []) as any[]
  console.log(`\nPART 1 - pending requests older than ${POSTPONE_RESPONSE_HOURS}h: ${rows.length}`)

  if (rows.length > 0) {
    const nowIso = new Date().toISOString()
    const { error: declineErr } = await supabase
      .from('postpone_requests')
      .update({ status: 'declined', responded_at: nowIso, updated_at: nowIso })
      .in('id', rows.map((r) => r.id))
    if (declineErr) throw new Error(`decline update failed: ${declineErr.message}`)

    for (const r of rows) {
      const { data: fx } = await supabase
        .from('fixtures')
        .select(`
          id,
          home_team:teams!fixtures_home_team_id_fkey(name),
          away_team:teams!fixtures_away_team_id_fkey(name)
        `)
        .eq('id', r.fixture_id)
        .maybeSingle()
      const matchLabel = `${teamName(fx?.home_team) ?? 'Home'} vs ${teamName(fx?.away_team) ?? 'Away'}`

      const { data: codeRow } = await supabase
        .from('match_codes')
        .select('code')
        .eq('fixture_id', r.fixture_id)
        .maybeSingle()
      const shareUrl = codeRow?.code ? `${APP_BASE}/submit-match/${codeRow.code}` : `/fixtures/${r.fixture_id}`

      if (r.requested_by) {
        await notify.insertNotificationsAndPush(supabase, {
          user_id: r.requested_by,
          type: 'fixture_postponed',
          title: 'Postponement declined',
          body: `${matchLabel}: your opponent did not answer within ${POSTPONE_RESPONSE_HOURS} hours, so the move to ${labelDate(String(r.new_date).slice(0, 10))} was declined. The match stays on its original date.`,
          data: { fixture_id: r.fixture_id, url: shareUrl },
          push_url: shareUrl,
        })
      }

      await supabase.from('audit_log').insert({
        admin_id: null,
        action: 'postpone_request_expired',
        target_type: 'fixture',
        target_id: r.fixture_id,
        details: {
          request_id: r.id,
          new_date: r.new_date,
          requested_by: r.requested_by,
          auto_declined: true,
          responded_at: nowIso,
          via: 'repair_script_2026-10-16',
        },
      })
      console.log(`  declined ${r.id} (${matchLabel})`)
    }
  }

  // ── PART 2: resolve the stuck fixture to a both-absent 0-0 ────────────────
  const { data: fx, error: fxErr } = await supabase
    .from('fixtures')
    .select(`
      id, tournament_id, round_type, status, scheduled_date,
      home_team_id, away_team_id,
      results!results_fixture_id_fkey(fixture_id),
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .eq('id', LIMBO_FIXTURE)
    .maybeSingle()
  if (fxErr || !fx) throw new Error(`limbo fixture select failed: ${fxErr?.message ?? 'not found'}`)

  const existingResults = Array.isArray((fx as any).results)
    ? (fx as any).results
    : (fx as any).results
      ? [(fx as any).results]
      : []
  const label = `${teamName((fx as any).home_team) ?? 'Home'} 0-0 ${teamName((fx as any).away_team) ?? 'Away'}`

  console.log(`\nPART 2 - limbo fixture: ${label} (status=${(fx as any).status})`)

  if (existingResults.length > 0) {
    console.log('  already has a result - skipping finalise')
  } else {
    // Dismiss the late not-responding report so nothing auto-approves a 3-0.
    const { data: pendingBd } = await supabase
      .from('backdoor_submissions')
      .select('id, side_claimed')
      .eq('fixture_id', LIMBO_FIXTURE)
      .eq('status', 'pending')
    const bdIds = ((pendingBd ?? []) as any[]).map((b) => b.id)
    if (bdIds.length > 0) {
      const { error: bdErr } = await supabase
        .from('backdoor_submissions')
        .update({ status: 'declined', reviewed_at: new Date().toISOString() })
        .in('id', bdIds)
      if (bdErr) throw new Error(`backdoor dismiss failed: ${bdErr.message}`)
      try {
        const bdNotify = await import('../lib/backdoor-notify.ts')
        await bdNotify.notifyBackdoorDecision(supabase, bdIds, 'declined')
      } catch (e) {
        console.error('  backdoor decision notify failed:', e)
      }
      console.log(`  dismissed ${bdIds.length} pending report(s)`)
    }

    const overrideReason = 'Both teams absent - auto-finalised (0-0, no points)'

    await supabase.from('result_confirmations').insert({
      fixture_id: LIMBO_FIXTURE,
      home_score: 0,
      away_score: 0,
      submitted_by: null,
    })

    const { data: result, error: resErr } = await supabase
      .from('results')
      .upsert(
        {
          fixture_id: LIMBO_FIXTURE,
          home_score: 0,
          away_score: 0,
          is_abandoned: false,
          finalised_by: null,
          override_reason: overrideReason,
        },
        { onConflict: 'fixture_id' }
      )
      .select('id')
      .single()
    if (resErr) throw new Error(`0-0 results upsert failed: ${resErr.message}`)

    await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', LIMBO_FIXTURE)

    // Void anything still pending (belt and braces).
    await supabase
      .from('backdoor_submissions')
      .update({ status: 'void_game_played' })
      .eq('fixture_id', LIMBO_FIXTURE)
      .eq('status', 'pending')

    const managerIds = [teamManagerId((fx as any).home_team), teamManagerId((fx as any).away_team)].filter(
      (id): id is string => !!id
    )
    if (managerIds.length > 0) {
      await notify.insertNotificationsAndPush(
        supabase,
        managerIds.map((user_id) => ({
          user_id,
          type: 'result_confirmed',
          title: 'Result Confirmed',
          body: label,
          data: { fixture_id: LIMBO_FIXTURE, home_score: '0', away_score: '0' },
        }))
      )
    }

    await supabase.from('audit_log').insert({
      admin_id: null,
      action: 'finalise_result',
      target_type: 'fixture',
      target_id: LIMBO_FIXTURE,
      details: {
        home_score: 0,
        away_score: 0,
        result_id: result?.id,
        home_absent: true,
        away_absent: true,
        auto_finalised: true,
        via: 'repair_script_2026-10-16',
      },
    })
    console.log('  finalised 0-0')
  }

  // Rebuild standings so the 0-0 counts immediately.
  const engine = await import('../lib/standings-engine.ts')
  const recalc = (engine as any).recalculateStandings ?? (engine as any).default?.recalculateStandings
  if (typeof recalc === 'function') {
    console.log('\nrecalculateStandings:', await recalc(LIMBO_TOURNAMENT))
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  const { data: stillPending } = await supabase
    .from('postpone_requests')
    .select('id, created_at')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
  const { data: fxCheck } = await supabase
    .from('fixtures')
    .select('id, status, results!results_fixture_id_fkey(home_score, away_score, override_reason)')
    .eq('id', LIMBO_FIXTURE)
    .maybeSingle()

  console.log('\n--- verify ---')
  console.log('stale pending remaining:', (stillPending ?? []).length)
  console.log('limbo fixture:', JSON.stringify(fxCheck))
  if ((stillPending ?? []).length > 0) throw new Error('Verification FAILED: stale pending requests remain')
  console.log('\nRepair complete and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
