import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Vercel cron: runs at 09:00 UTC daily (11:00 SAST)
// Sends "you have a match today" push notification to both managers
export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = await createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Find all fixtures scheduled for today
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id),
      tournament:tournaments(name)
    `)
    .eq('scheduled_date', today)
    .eq('status', 'scheduled')

  if (!fixtures?.length) {
    return NextResponse.json({ sent: 0, message: 'No fixtures today' })
  }

  let sent = 0

  for (const fixture of fixtures) {
    const home = (fixture as any).home_team
    const away = (fixture as any).away_team
    const tournament = (fixture as any).tournament
    const fixtureUrl = `/fixtures/${fixture.id}`
    const label = `${home?.name ?? '?'} vs ${away?.name ?? '?'}`
    const md = `MD${fixture.matchday} · ${tournament?.name ?? 'EFA'}`

    // Home manager notification
    if (home?.manager_id) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', home.manager_id)

      if (subs?.length) {
        await sendPushToUser(subs, {
          title: `🏠 Matchday! You're playing at HOME`,
          body: `${label} · ${md}\nCreate the matchroom and share the code with your opponent!`,
          url: fixtureUrl,
          tag: `matchday-${fixture.id}-home`,
          requireInteraction: true,
        })
        sent++
      }
    }

    // Away manager notification
    if (away?.manager_id) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', away.manager_id)

      if (subs?.length) {
        await sendPushToUser(subs, {
          title: `✈️ Matchday! You're playing AWAY`,
          body: `${label} · ${md}\nWait for ${home?.name ?? 'home team'} to share the matchroom code.`,
          url: fixtureUrl,
          tag: `matchday-${fixture.id}-away`,
          requireInteraction: true,
        })
        sent++
      }
    }
  }

  return NextResponse.json({ sent, fixtures: fixtures.length })
}
