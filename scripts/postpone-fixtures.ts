/**
 * Admin bulk action: postpone scheduled fixtures from one date to another,
 * preserving the existing behaviour of the /api/admin/postpone-fixture route:
 * update scheduled_date, mark is_postponed, notify both managers (in-app),
 * and write an audit_log entry.
 *
 * scheduled_date is a DATE column storing the SAST calendar match day.
 *
 * Usage:
 *   npx tsx scripts/postpone-fixtures.ts 2026-08-14                # +1 day
 *   npx tsx scripts/postpone-fixtures.ts 2026-08-14 --days 3
 *   npx tsx scripts/postpone-fixtures.ts --from 2026-08-14 --to 2026-08-18
 *   npx tsx scripts/postpone-fixtures.ts 2026-08-14 --dry-run      # preview only
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

const APP_TIME_ZONE = 'Africa/Johannesburg'
const ADMIN_ID = '87d8afba-296d-4512-9811-3d32a76eb37a' // celemqhele

// ---- CLI parsing ----
function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') { args.dryRun = true; continue }
    if (a === '--from' || a === '-f') { args.from = argv[++i]; continue }
    if (a === '--to' || a === '-t') { args.to = argv[++i]; continue }
    if (a === '--days' || a === '-d') { args.days = argv[++i]; continue }
    if (a === '--status' || a === '-s') { args.status = argv[++i]; continue }
    if (!args.from && /^\d{4}-\d{2}-\d{2}$/.test(a)) { args.from = a }
  }
  return args
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const opts = parseArgs(process.argv.slice(2))

const fromDate = opts.from as string
if (!fromDate || !DATE_RE.test(fromDate)) {
  console.error('Usage: npx tsx scripts/postpone-fixtures.ts <YYYY-MM-DD> [--to YYYY-MM-DD | --days N] [--status scheduled] [--dry-run]')
  process.exit(1)
}

const status = (opts.status as string) ?? 'scheduled'
let toDate: string
if (opts.to) {
  if (!DATE_RE.test(opts.to as string)) {
    console.error('--to must be YYYY-MM-DD')
    process.exit(1)
  }
  toDate = opts.to as string
} else {
  const days = parseInt((opts.days as string) ?? '1', 10)
  const d = new Date(`${fromDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  toDate = d.toISOString().slice(0, 10)
}

const dryRun = !!opts.dryRun

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function formatJhb(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: APP_TIME_ZONE,
  }) + ' · ' + date.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  })
}

async function main() {
  const { data: fixtures, error: fetchError } = await supabase
    .from('fixtures')
    .select(`
      id, status, scheduled_date, matchday,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .eq('status', status)
    .eq('scheduled_date', fromDate)

  if (fetchError) throw new Error(`fetch failed: ${fetchError.message}`)
  if (!fixtures || fixtures.length === 0) {
    console.log(`No '${status}' fixtures found on ${fromDate}. Nothing to do.`)
    process.exit(0)
  }

  console.log(`Found ${fixtures.length} '${status}' fixtures on ${fromDate} to postpone to ${toDate}.${dryRun ? ' [DRY RUN]' : ''}`)

  const updates: any[] = []
  const notificationRows: any[] = []
  const auditRows: any[] = []

  for (const f of fixtures as any[]) {
    const old_date = f.scheduled_date
    const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
    const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
    const matchLabel = `${home?.name ?? 'Home'} vs ${away?.name ?? 'Away'}`
    const oldWhen = formatJhb(new Date(`${fromDate}T00:00:00Z`))
    const newWhen = formatJhb(new Date(`${toDate}T00:00:00Z`))

    updates.push({ id: f.id, matchday: f.matchday, old_date, new_date: toDate, matchLabel })

    const managerIds = [home?.manager_id, away?.manager_id].filter((v): v is string => !!v)
    for (const uid of managerIds) {
      notificationRows.push({
        user_id: uid,
        type: 'fixture_postponed',
        title: 'Match Postponed',
        body: `${matchLabel} has been moved from ${oldWhen} to ${newWhen}.`,
        data: { fixture_id: f.id, old_date, new_date: toDate },
      })
    }

    auditRows.push({
      admin_id: ADMIN_ID,
      action: 'postpone_fixture',
      target_type: 'fixture',
      target_id: f.id,
      details: { old_date, new_date: toDate, matchday: f.matchday },
    })
  }

  console.table(updates.map((u) => ({
    matchday: u.matchday,
    match: u.matchLabel,
    old: u.old_date,
    new: u.new_date,
  })))

  if (dryRun) {
    console.log('\nDRY RUN — no changes written.')
    return
  }

  const { error: updateError } = await supabase
    .from('fixtures')
    .update(
      updates.map((u) => ({
        scheduled_date: u.new_date,
        is_postponed: true,
        postponed_from: u.old_date,
      }))
    )
    .in('id', updates.map((u) => u.id))

  if (updateError) throw new Error(`fixture update failed: ${updateError.message}`)

  if (notificationRows.length > 0) {
    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notificationRows)
    if (notifError) console.warn('[notify] insert error:', notifError.message)
  }

  const { error: auditError } = await supabase
    .from('audit_log')
    .insert(auditRows)
  if (auditError) console.warn('[audit] insert error:', auditError.message)

  console.log(`\nPostponed ${updates.length} fixtures from ${fromDate} to ${toDate}.`)
  console.log(`Inserted ${notificationRows.length} in-app notifications.`)
  console.log(`Inserted ${auditRows.length} audit_log entries.`)
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
