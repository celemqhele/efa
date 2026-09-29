/**
 * Assigns a manager to a club, mirroring app/api/admin/managers/assign/route.ts
 * exactly, but usable from the terminal (that route needs an admin Supabase
 * session).
 *
 * Steps, in the same order as the route:
 *   1. resolve the team row and the target profile
 *   2. enforce the 1-week post-sack cooldown (--override to bypass)
 *   3. set teams.manager_id on every row sharing the club's logo (siblings)
 *   4. close open manager_tenures for those rows, then open new ones
 *   5. write an audit_log entry
 *   6. reclaimManagerSlots() - hand the club's own vacant seats (and their
 *      not-yet-played fixtures / standings rows) to the new manager
 *
 * The Vacant placeholder is not a real club and is refused here, matching the
 * route's guard; use the admin UI for that path (assignVacantSeatToManager).
 *
 * Usage:
 *   npx tsx scripts/assign-manager-to-club.ts --admin wandile \
 *     --assign "dot:Lerumo Lions:+27 78 483 1815" \
 *     --assign "karabo_:Upington City:+27 64 935 3180"
 *
 *   --assign "username:Club Name[:+27 phone]"
 *   --admin <username>   audit-log attribution (defaults to the first admin)
 *   --override           ignore the post-sack cooldown
 *   --dry-run            resolve and report, write nothing
 *
 * The phone (when given) is stored as supplied, then reported back normalised so
 * a malformed value like "270784831815" (country code followed by a local
 * leading zero) is visible in the output.
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'process'
import { isVacantPlaceholderTeam, reclaimManagerSlots } from '@/lib/slot-utils'

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
// Same trick as scripts/create-season4.ts: no env file carries
// NEXT_PUBLIC_SUPABASE_URL, and the pooler connection string hides the project
// ref, so read it out of the service-role JWT.
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
// reclaimManagerSlots() reads this via createAdminClient() internally.
process.env.SUPABASE_SERVICE_ROLE_KEY = key

const db = createClient(supabaseUrl, key) as any

const SACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const flag = (name: string) => process.argv.includes(`--${name}`)

function digits(n: string | null | undefined): string {
  return String(n ?? '').replace(/\D/g, '')
}

/**
 * Supabase mutations resolve with { error } instead of throwing, so an unchecked
 * write fails silently and the run still prints a success line — leaving a
 * half-applied assignment (manager_id set, no tenure, no audit row) that looks
 * fine until someone reads the history. The route only checks its teams update;
 * this checks every write.
 */
function must(res: { error: { message: string } | null } | null, what: string): void {
  if (res?.error) throw new Error(`${what} failed: ${res.error.message}`)
}

async function main() {
  const raw = process.argv.flatMap((a, i) => (a === '--assign' ? [process.argv[i + 1]] : []))
  if (raw.length === 0) {
    console.error('No --assign pairs given.')
    process.exit(1)
  }
  const dryRun = flag('dry-run')
  const override = flag('override')

  const adminUsername = arg('admin')
  const { data: adminRow } = adminUsername
    ? await db.from('profiles').select('id, username').eq('username', adminUsername).single()
    : await db.from('profiles').select('id, username').eq('role', 'admin').order('created_at').limit(1).single()
  if (!adminRow) {
    console.error(adminUsername ? `Admin '${adminUsername}' not found.` : 'No admin profile found.')
    process.exit(1)
  }

  for (const pair of raw) {
    const [username, clubName, phone] = pair.split(':').map((s) => (s ?? '').trim())
    if (!username || !clubName) {
      console.error(`Bad --assign '${pair}'. Expected "username:Club Name[:phone]".`)
      process.exit(1)
    }

    const { data: target } = await db
      .from('profiles').select('id, username, sacked_at').eq('username', username).single()
    if (!target) {
      console.error(`✗ profile '${username}' not found`)
      process.exit(1)
    }

    const { data: team } = await db
      .from('teams').select('id, name, logo_league_folder, logo_team_slug, manager_id')
      .eq('name', clubName).single()
    if (!team) {
      console.error(`✗ club '${clubName}' not found`)
      process.exit(1)
    }
    if (isVacantPlaceholderTeam(team)) {
      console.error(`✗ '${clubName}' is the Vacant placeholder — use the admin UI for that path.`)
      process.exit(1)
    }

    if (!override && target.sacked_at) {
      const ends = new Date(new Date(target.sacked_at).getTime() + SACK_COOLDOWN_MS)
      if (ends.getTime() > Date.now()) {
        console.error(`✗ @${username} was sacked; cooldown ends ${ends.toISOString()} (use --override)`)
        process.exit(1)
      }
    }

    // Sibling rows sharing the club's logo, exactly as the route collects them.
    let allClubIds: string[] = [team.id]
    if (team.logo_league_folder && team.logo_team_slug) {
      const { data: siblings } = await db
        .from('teams').select('id')
        .eq('logo_league_folder', team.logo_league_folder)
        .eq('logo_team_slug', team.logo_team_slug)
        .neq('id', team.id)
      allClubIds = [team.id, ...(siblings ?? []).map((s: any) => s.id as string)]
    }

    if (dryRun) {
      console.log(`[dry-run] @${username} -> ${team.name} (${allClubIds.length} team row(s))` +
        (phone ? `, would store phone ${phone} (digits ${digits(phone)})` : ', no phone given'))
      continue
    }

    // Only reached on a real run — --dry-run must not write anything.
    if (phone) must(await db.from('profiles').update({ phone }).eq('id', target.id), `store phone for @${username}`)

    must(
      await db.from('teams').update({ manager_id: target.id }).in('id', allClubIds),
      `set teams.manager_id for ${team.name}`
    )

    const now = new Date().toISOString()
    must(
      await db.from('manager_tenures' as any)
        .update({ ended_at: now }).in('team_id', allClubIds).is('ended_at', null),
      'close open tenures'
    )
    must(
      await db.from('manager_tenures' as any).insert(
        allClubIds.map((id) => ({
          team_id: id,
          manager_id: target.id,
          manager_username: target.username,
          started_at: now,
        }))
      ),
      'open new tenures'
    )

    must(
      await db.from('audit_log').insert({
        admin_id: adminRow.id,
        action: 'assign_manager',
        target_type: 'team',
        target_id: team.id,
        details: { team_name: team.name, assigned_user_id: target.id, username: target.username, via: 'scripts/assign-manager-to-club.ts' },
      }),
      'write audit_log'
    )

    const reclaimed = await reclaimManagerSlots(db, target.id, team.id)

    console.log(
      `✓ @${target.username} -> ${team.name} | team row(s) ${allClubIds.length} | ` +
      `seats reclaimed ${reclaimed}` + (phone ? ` | phone stored ${phone} (digits ${digits(phone)})` : '')
    )
  }
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
