// Supabase Edge Function — daily notification cron
// Called three times per day with ?type= query param:
//   day_before  → previous evening: "You have X fixtures tomorrow"
//   morning     → 08:00 SAST (06:00 UTC): "Matchday! X fixtures due today"
//   warning     → 13:00 SAST (11:00 UTC): "1 hour left"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const type = new URL(req.url).searchParams.get('type') ?? 'morning'
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86400000)
  const targetDate = type === 'day_before'
    ? tomorrow.toISOString().split('T')[0]
    : today.toISOString().split('T')[0]

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id,
      home_team:teams!home_team_id ( manager_id ),
      away_team:teams!away_team_id ( manager_id )
    `)
    .eq('scheduled_date', targetDate)
    .eq('status', 'scheduled')

  // Tally fixture count per manager
  const userFixtureCount: Record<string, number> = {}
  for (const f of fixtures ?? []) {
    const homeId = (f.home_team as { manager_id: string | null } | null)?.manager_id
    const awayId = (f.away_team as { manager_id: string | null } | null)?.manager_id
    if (homeId) userFixtureCount[homeId] = (userFixtureCount[homeId] ?? 0) + 1
    if (awayId) userFixtureCount[awayId] = (userFixtureCount[awayId] ?? 0) + 1
  }

  const inserts = []
  for (const [userId, count] of Object.entries(userFixtureCount)) {
    let title: string, body: string

    if (type === 'day_before') {
      title = 'Match Tomorrow'
      body = `You have ${count} fixture${count > 1 ? 's' : ''} tomorrow, all due by 14:00 SAST.`
    } else if (type === 'morning') {
      title = 'Matchday!'
      body = `${count} fixture${count > 1 ? 's' : ''} due today by 14:00 SAST. Get your games in!`
    } else {
      title = '1 Hour Left'
      body = `${count} fixture${count > 1 ? 's' : ''} still pending. Deadline: 14:00 SAST.`
    }

    inserts.push({
      user_id: userId,
      type: 'match_reminder',
      title,
      body,
      data: { date: targetDate, notification_type: type },
    })
  }

  if (inserts.length > 0) {
    await supabase.from('notifications').insert(inserts)
  }

  // Also send Web Push to subscribed users
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

  if (vapidPublic && vapidPrivate && inserts.length > 0) {
    const userIds = inserts.map((n) => n.user_id)
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', userIds)

    for (const sub of subs ?? []) {
      const notif = inserts.find((n) => n.user_id === sub.user_id)
      if (!notif) continue
      try {
        await fetch('https://push.services.mozilla.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: notif.title, body: notif.body, url: '/' }),
        })
      } catch {
        // Silently skip failed push deliveries
      }
    }
  }

  return Response.json({ notified: inserts.length, type, targetDate })
})
