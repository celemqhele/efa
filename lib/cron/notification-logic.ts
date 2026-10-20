import type { SupabaseClient } from '@supabase/supabase-js'
import { insertNotificationsAndPush, type NotificationRow } from '@/lib/notify'
import { getSastDateKey } from '@/lib/app-time'

type ReminderType = 'morning' | 'midday' | 'afternoon' | 'deadline'

interface FixtureRow {
  id: string
  status: string
  home_team_id: string
  home_team_name: string
  home_manager_id: string | null
  away_team_id: string
  away_team_name: string
  away_manager_id: string | null
  postponed_confirmed: boolean
}

// Shown on every reminder for a fixture that was postponed and still has to be
// played. `is_postponed` cannot be used for this: the normal result-submission
// path sets it too, so it is true on almost every finished fixture. The reliable
// marker is `postponed_confirmed`, which is only set on a postponed fixture whose
// agreed score is already in the standings while the game itself is still to be
// played on the moved date.
const POSTPONEMENT_NOTE =
  'Please note this is a postponement game, Please play the game to avoid penalties'

interface ManagerFixtures {
  userId: string
  fixtures: FixtureRow[]
  sides: ('home' | 'away')[]
}

function getSastDateString(offsetDays = 0): string {
  return getSastDateKey(new Date(), offsetDays)
}

function getFixtureList(managerFixtures: ManagerFixtures): string {
  return managerFixtures.fixtures
    .map((f) => `${f.home_team_name} vs ${f.away_team_name}`)
    .join(', ')
}

export async function runNotificationCron(
  supabase: SupabaseClient,
  type: ReminderType
) {
  const targetDate = getSastDateString()

  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select(`
      id,
      status,
      postponed_confirmed,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .eq('scheduled_date', targetDate)
    // Postponed-confirmed fixtures carry status 'confirmed' (the agreed 3-0 is
    // already in the standings) but are still to be played on their moved date,
    // so they need the same reminders as anything scheduled.
    .or('status.in.(scheduled,awaiting_confirmation),postponed_confirmed.eq.true')

  if (error) {
    console.error('[notification-cron] fixture query error:', error.message)
    return { notified: 0, type, targetDate, error: error.message }
  }

  const flatFixtures: FixtureRow[] = (fixtures ?? []).map((f: any) => {
    const ht = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
    const at = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
    return {
      id: f.id,
      status: f.status,
      home_team_id: ht?.id ?? '',
      home_team_name: ht?.name ?? '?',
      home_manager_id: ht?.manager_id ?? null,
      away_team_id: at?.id ?? '',
      away_team_name: at?.name ?? '?',
      away_manager_id: at?.manager_id ?? null,
      postponed_confirmed: f.postponed_confirmed === true,
    }
  })

  // Group fixtures by manager
  const managerMap = new Map<string, ManagerFixtures>()
  for (const f of flatFixtures) {
    if (f.home_manager_id) {
      const existing = managerMap.get(f.home_manager_id)
      if (existing) { existing.fixtures.push(f); existing.sides.push('home') }
      else managerMap.set(f.home_manager_id, { userId: f.home_manager_id, fixtures: [f], sides: ['home'] })
    }
    if (f.away_manager_id) {
      const existing = managerMap.get(f.away_manager_id)
      if (existing) { existing.fixtures.push(f); existing.sides.push('away') }
      else managerMap.set(f.away_manager_id, { userId: f.away_manager_id, fixtures: [f], sides: ['away'] })
    }
  }

  const inserts: NotificationRow[] = []

  for (const [userId, mf] of managerMap) {
    const count = mf.fixtures.length
    const list = getFixtureList(mf)
    let title: string
    let body: string

    switch (type) {
      case 'morning':
        title = 'Good luck today!'
        body = count === 1
          ? `You have 1 fixture today: ${list}. Deadline: 14:00 SAST.`
          : `You have ${count} fixtures today: ${list}. Deadline: 14:00 SAST.`
        break
      case 'midday':
        title = 'Your remaining matches'
        body = count === 1
          ? `1 fixture still to play: ${list}. Submit your result!`
          : `${count} fixtures still to play: ${list}. Submit your results!`
        break
      case 'afternoon':
        title = 'Deadline approaching'
        body = count === 1
          ? `You have 1 fixture remaining (${list}). Submit before 14:00 SAST to avoid a walkover.`
          : `You have ${count} fixtures remaining (${list}). Submit before 14:00 SAST to avoid a walkover.`
        break
      case 'deadline':
        title = '1 hour left!'
        body = count === 1
          ? `${list} is still pending! Play now to avoid an automatic loss.`
          : `${count} fixtures still pending! Play now to avoid an automatic loss.`
        break
    }

    // A postponed game whose agreed score is already in the standings still has
    // to be played, so every reminder for it carries the postponement note.
    if (mf.fixtures.some((f) => f.postponed_confirmed)) {
      body = `${body}\n\n${POSTPONEMENT_NOTE}`
    }

    inserts.push({
      user_id: userId,
      type: 'match_reminder',
      title: title!,
      body: body!,
      data: { date: targetDate, notification_type: type },
      push_url: '/fixtures',
    })
  }

  if (inserts.length > 0) {
    await insertNotificationsAndPush(supabase, inserts)
  }

  return { notified: inserts.length, type, targetDate }
}
