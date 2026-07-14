import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runNotificationCron } from '@/lib/cron/notification-logic'

const VALID_TYPES = ['morning', 'midday', 'afternoon', 'deadline'] as const

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = request.nextUrl.searchParams.get('type')
  if (!type || !VALID_TYPES.includes(type as any)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = await createAdminClient()
  const result = await runNotificationCron(supabase, type as typeof VALID_TYPES[number])
  return NextResponse.json(result)
}
