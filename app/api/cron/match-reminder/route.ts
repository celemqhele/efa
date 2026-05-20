import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Vercel cron: runs at 18:00 UTC daily (20:00 SAST)
// Sends "make sure you've played" reminder for today's matches
export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = await createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Find today's fixtures that are NOT yet confirmed
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .eq('scheduled_date', today)
    .in('status', ['scheduled', 'awaiting_confirmation'])

  if (!fixtures?.length) {
    return NextResponse.json({ sent: 0, message: 'No pending fixtures today' })
  }

  let sent = 0

  for (const fixture of fixtures) {
    const home = (fixture as any).home_team
    const away = (fixture as any).away_team
    const label = `${home?.name ?? '?'} vs ${away?.name ?? '?'}`
    const fixtureUrl = `/fixtures/${fixture.id}`

    const reminderPayload = {
      title: `⏰ Match Reminder — MD${fixture.matchday}`,
      body: `${label} — Have you played yet? Submit your result and send screenshots to the WhatsApp group! 📱`,
      url: fixtureUrl,
      tag: `reminder-${fixture.id}`,
    }

    for (const manager of [home, away]) {
      if (!manager?.manager_id) continue
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', manager.manager_id)

      if (subs?.length) {
        await sendPushToUser(subs, reminderPayload)
        sent++
      }
    }
  }

  return NextResponse.json({ sent, fixtures: fixtures.length })
}
