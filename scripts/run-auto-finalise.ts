/**
 * Run the auto-finalise cron in-process, for a manual catch-up.
 *
 * The deployed route (/api/cron/auto-finalise-prev-day) is only reachable with
 * `Authorization: Bearer $CRON_SECRET`, and the production CRON_SECRET is a
 * Vercel *sensitive* env var, so it cannot be read back (neither from
 * .env.local nor from `vercel env pull`, which redact it). This runner imports
 * the very same route module and calls its GET handler with a synthetic
 * request, so the catch-up exercises the real code path — no logic is
 * duplicated here.
 *
 * Usage:
 *   npx tsx scripts/run-auto-finalise.ts                    # normal run
 *   npx tsx scripts/run-auto-finalise.ts 2026-10-18         # catch up to a date
 *   npx tsx scripts/run-auto-finalise.ts 2026-10-18 --dry   # log only, no writes
 */
import { loadEnvFile } from 'process'

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

const cutoff = (process.argv[2] ?? '').trim()
const dry = process.argv.includes('--dry')

async function main() {
  const { GET } = await import('../app/api/cron/auto-finalise-prev-day/route.ts')

  const params = new URLSearchParams()
  if (/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) params.set('cutoff', cutoff)
  if (dry) params.set('dryRun', '1')
  const qs = params.toString()

  const url = `http://localhost/api/cron/auto-finalise-prev-day${qs ? `?${qs}` : ''}`

  // The route compares against `Bearer ${process.env.CRON_SECRET}`; build the
  // header from the same source so a blank/missing secret in this environment
  // still authenticates.
  const request = {
    url,
    headers: { get: (k: string) => (k === 'Authorization' ? `Bearer ${process.env.CRON_SECRET ?? ''}` : null) },
  }

  console.log(`GET ${url}${dry ? '   (DRY RUN - no writes)' : ''}`)
  const res: any = await GET(request as any)
  const body = await res.json()
  console.log(JSON.stringify(body, null, 2))
}

main().catch((e) => {
  console.error('catch-up failed:', e)
  process.exit(1)
})
