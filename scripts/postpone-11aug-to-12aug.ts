/**
 * Admin bulk action: postpone the 14 fixtures scheduled for 11 Aug (02:00 SAST)
 * to 12 Aug (same kickoff time 02:00 SAST), preserving the existing behaviour of
 * the /api/admin/postpone-fixture route: update scheduled_date, mark is_postponed,
 * notify both managers (in-app), and write an audit_log entry.
 *
 * Run: npx tsx scripts/postpone-11aug-to-12aug.ts
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
  // Derive the project URL from the Supabase DB connection string (postgres.<ref>)
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

const FIXTURE_IDS: string[] = [
  '6752a43f-8e07-4e54-a88e-22a49e565895', // MD641 Bayer Leverkusen vs Manchester City
  '8d90ca45-fde9-4bdb-92ab-d100eb4c66ec', // MD640 Chelsea vs Al Hilal
  '481cd96c-3fa1-41da-8c41-65d0880f3e75', // MD617 Bayer Leverkusen vs Real Betis
  '29a341fa-df9f-4a48-878d-d7299798fa40', // MD629 Inter Milan vs Real Betis
  'cddf9892-1a66-4a72-a2ca-4ad2630192ac', // MD635 Al Khaleej vs Arsenal
  'f8c1351d-6c3d-41ce-b340-14da35ebb110', // MD7 Paris Saint Germain vs Sporting Cp
  'bdeee187-0674-4101-ae00-cd39f42f3b82', // MD650 Arsenal vs Manchester United
  '7868a991-d1b8-4d85-afb5-eeda73855871', // MD639 Al Khaleej vs Manchester United
  '409cfbaf-dc60-4a4d-b4f4-c677de14cb00', // MD628 Bayern Munchen vs Chelsea
  'a13a7c2c-96ae-49e0-8fd4-bece691e3b7d', // MD623 Barcelona vs Palmeiras
  'f1e32e85-220f-4b68-bace-8b858e46d24c', // MD612 Arsenal vs Al Khaleej
  'c719fd39-fe49-44d3-8099-8875dfd77d57', // MD14 Barcelona vs Brighton & Hove Albion
  '04bed437-0998-456f-8c3c-641e19c007bb', // MD11 Al Ettifaq vs Nantes
  'f1bebdda-96df-4a7b-88d3-51ec76788920', // MD13 Palmeiras vs Brighton & Hove Albion
]

function formatJhb(date: Date): string {
  const datePart = date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: APP_TIME_ZONE,
  })
  const timePart = date.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  })
  return `${datePart} · ${timePart}`
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: fixtures, error: fetchError } = await supabase
    .from('fixtures')
    .select(`
      id, status, scheduled_date, matchday,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .in('id', FIXTURE_IDS)

  if (fetchError) throw new Error(`fetch failed: ${fetchError.message}`)
  if (!fixtures || fixtures.length !== FIXTURE_IDS.length) {
    const missing = FIXTURE_IDS.filter(
      (id) => !fixtures?.some((f: any) => f.id === id)
    )
    console.error(`Expected ${FIXTURE_IDS.length} fixtures, found ${fixtures?.length ?? 0}`, { missing })
    process.exit(1)
  }

  const FINISHED = ['completed', 'confirmed', 'abandoned']
  const rows = (fixtures as any[]).map((f) => {
    const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
    const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
    return {
      id: f.id,
      matchday: f.matchday,
      status: f.status,
      old_date: f.scheduled_date,
      new_date: f.scheduled_date ? addDays(new Date(f.scheduled_date), 1).toISOString() : null,
      home,
      away,
    }
  })

  const blocked = rows.filter((r) => FINISHED.includes(r.status))
  if (blocked.length > 0) {
    console.error('Cannot postpone finished fixtures:', blocked.map((b) => `${b.matchday} ${b.home?.name} vs ${b.away?.name} [${b.status}]`))
    process.exit(1)
  }

  const updates: any[] = []
  const notificationRows: any[] = []
  const auditRows: any[] = []

  for (const r of rows) {
    if (!r.new_date) continue
    updates.push({
      id: r.id,
      matchday: r.matchday,
      old_date: r.old_date,
      new_date: r.new_date,
    })

    const homeName = r.home?.name ?? 'Home'
    const awayName = r.away?.name ?? 'Away'
    const matchLabel = `${homeName} vs ${awayName}`
    const oldWhen = r.old_date ? formatJhb(new Date(r.old_date)) : 'TBD'
    const newWhen = formatJhb(new Date(r.new_date))

    const managerIds = [r.home?.manager_id, r.away?.manager_id].filter((v): v is string => !!v)
    for (const uid of managerIds) {
      notificationRows.push({
        user_id: uid,
        type: 'fixture_postponed',
        title: 'Match Postponed',
        body: `${matchLabel} has been moved from ${oldWhen} to ${newWhen}.`,
        data: {
          fixture_id: r.id,
          old_date: r.old_date,
          new_date: r.new_date,
          home_team: homeName,
          away_team: awayName,
        },
      })
    }

    auditRows.push({
      admin_id: ADMIN_ID,
      action: 'postpone_fixture',
      target_type: 'fixture',
      target_id: r.id,
      details: {
        old_date: r.old_date,
        new_date: r.new_date,
        matchday: r.matchday,
      },
    })
  }

  console.table(updates.map((u) => ({
    matchday: u.matchday,
    old_date: u.old_date,
    new_date: u.new_date,
  })))

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

  console.log(`\nPostponed ${updates.length} fixtures to 12 Aug (02:00 SAST).`)
  console.log(`Inserted ${notificationRows.length} in-app notifications.`)
  console.log(`Inserted ${auditRows.length} audit_log entries.`)
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
