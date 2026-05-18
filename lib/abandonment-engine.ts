import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export async function processAbandonments(supabase: SupabaseClient<Database>) {
  const today = new Date().toISOString().split('T')[0]

  // Get all scheduled fixtures for today with no result
  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select(`
      id,
      home_team_id,
      away_team_id,
      tournament_id,
      waiting_reports (reported_by_team_id)
    `)
    .eq('scheduled_date', today)
    .eq('status', 'scheduled')

  if (error || !fixtures) return { processed: 0, errors: [error?.message] }

  const processed: string[] = []
  const errors: string[] = []

  for (const fixture of fixtures as any[]) {
    const reporters = new Set(
      (fixture.waiting_reports as { reported_by_team_id: string }[] | null)?.map((r) => r.reported_by_team_id) ?? []
    )

    const homeReported = reporters.has(fixture.home_team_id)
    const awayReported = reporters.has(fixture.away_team_id)

    let abandonedType: 'home' | 'away' | 'both' | null = null
    let homeScore = 0
    let awayScore = 0

    if (homeReported && !awayReported) {
      // Away abandoned: away loss, home win
      abandonedType = 'away'
      homeScore = 3; awayScore = 0
    } else if (awayReported && !homeReported) {
      // Home abandoned: home loss, away win
      abandonedType = 'home'
      homeScore = 0; awayScore = 3
    } else if (!homeReported && !awayReported) {
      // Neither showed: 0-0, no points (abandoned_both)
      abandonedType = 'both'
      homeScore = 0; awayScore = 0
    } else {
      // Both reported: both showed, not an abandonment — skip
      continue
    }

    const { error: resultError } = await supabase
      .from('results')
      .insert({
        fixture_id: fixture.id,
        home_score: homeScore,
        away_score: awayScore,
        is_abandoned: true,
        abandoned_type: abandonedType,
      })

    if (resultError) {
      errors.push(`Fixture ${fixture.id}: ${resultError.message}`)
      continue
    }

    await supabase
      .from('fixtures')
      .update({ status: `abandoned_${abandonedType}` })
      .eq('id', fixture.id)

    await supabase.from('audit_log').insert({
      admin_id: '00000000-0000-0000-0000-000000000000',
      action: 'auto_abandonment',
      target_type: 'fixture',
      target_id: fixture.id,
      details: { abandoned_type: abandonedType, home_team_id: fixture.home_team_id, away_team_id: fixture.away_team_id },
    })

    processed.push(fixture.id)
  }

  // Check for teams with 3+ abandonments
  const { data: flaggedTeams } = await supabase
    .from('teams')
    .select('id, name, abandon_count, profiles!manager_id(username)')
    .gte('abandon_count', 3)

  if (flaggedTeams && flaggedTeams.length > 0) {
    // Notify all admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    for (const team of flaggedTeams) {
      for (const admin of admins ?? []) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          type: 'team_request',
          title: '3+ Abandonments',
          body: `${(team.profiles as unknown as { username: string } | null)?.username ?? team.name} has 3+ abandonments — review for sacking`,
          data: { team_id: team.id },
        })
      }
    }
  }

  return { processed: processed.length, errors }
}
