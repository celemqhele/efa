/**
 * One-off: run the poll pick auto-approval pass immediately instead of waiting
 * for the hourly cron. Uses the same lib/poll-auto-approve.ts the cron route
 * calls, so behaviour is identical.
 *
 * Usage: npx tsx scripts/approve-due-poll-picks.ts
 */
import { loadEnvFile } from 'process'
import { createClient } from '@supabase/supabase-js'
import { approveDuePollPicks } from '../lib/poll-auto-approve'

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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const db = createClient(url, key) as any

  const { count: pendingBefore } = await db
    .from('poll_applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  console.log(`Pending before: ${pendingBefore ?? 0}`)

  const { approved, users } = await approveDuePollPicks(db)
  console.log(`Approved: ${approved} across ${users} users`)

  const { count: pendingAfter } = await db
    .from('poll_applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  console.log(`Pending after: ${pendingAfter ?? 0}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
