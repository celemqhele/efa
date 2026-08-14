/**
 * Admin bulk action: postpone all fixtures scheduled for 2026-08-11
 * to 2026-08-12, preserving the existing behavior: update scheduled_date, 
 * mark is_postponed, notify both managers (in-app), and write an audit_log entry.
 *
 * Run: npx tsx scripts/postpone-today-to-tomorrow.ts
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

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

async function main() {
  const { data: fixtures, error: fetchError } = await supabase
    .from('fixtures')
    .select(`
      id, status, scheduled_date, matchday,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .eq('scheduled_date', '2026-08-12')
    .eq('status', 'scheduled')

  if (fetchError) throw new Error(`fetch failed: ${fetchError.message}`)
  if (!fixtures || fixtures.length === 0) {
    console.log('No fixtures found to postpone for 2026-08-11.')
    process.exit(0)
  }

  console.log(`Found ${fixtures.length} fixtures to postpone.`)

  const updates: any[] = []
  const notificationRows: any[] = []
  const auditRows: any[] = []

  for (const f of fixtures as any[]) {
    const old_date = f.scheduled_date
    const new_date = addDays(new Date(old_date), 1).toISOString()
    
    updates.push({ id: f.id, scheduled_date: new_date, is_postponed: true, postponed_from: old_date })

    const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
    const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
    const matchLabel = `${home?.name ?? 'Home'} vs ${away?.name ?? 'Away'}`
    const oldWhen = formatJhb(new Date(old_date))
    const newWhen = formatJhb(new Date(new_date))

    const managerIds = [home?.manager_id, away?.manager_id].filter((v): v is string => !!v)
    for (const uid of managerIds) {
      notificationRows.push({
        user_id: uid,
        type: 'fixture_postponed',
        title: 'Match Postponed',
        body: `${matchLabel} has been moved from ${oldWhen} to ${newWhen}.`,
        data: { fixture_id: f.id, old_date, new_date },
      })
    }

    auditRows.push({
      admin_id: ADMIN_ID,
      action: 'postpone_fixture',
      target_type: 'fixture',
      target_id: f.id,
      details: { old_date, new_date, matchday: f.matchday },
    })
  }

  const { error: updateError } = await supabase
    .from('fixtures')
    .upsert(updates)

  if (updateError) throw new Error(`fixture update failed: ${updateError.message}`)

  if (notificationRows.length > 0) await supabase.from('notifications').insert(notificationRows)
  await supabase.from('audit_log').insert(auditRows)

  console.log(`Successfully postponed ${fixtures.length} fixtures.`)
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
