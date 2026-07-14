import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUsers, type PushPayload } from '@/lib/push'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.userIds?.length || !body?.payload?.title) {
    return NextResponse.json({ error: 'userIds and payload required' }, { status: 400 })
  }

  const supabase = await createAdminClient()
  const payload: PushPayload = body.payload
  const results = await sendPushToUsers(supabase, body.userIds, payload)

  return NextResponse.json({
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  })
}
