import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { approveDuePollPicks } from '@/lib/poll-auto-approve'

// Hourly pass that locks poll picks once their 24h change window has closed.
// The logic lives in lib/poll-auto-approve.ts so scripts/approve-due-poll-picks.ts
// can run the exact same approval for backfills.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()

  try {
    const { approved, users } = await approveDuePollPicks(supabase)
    return NextResponse.json({ approved, users })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
