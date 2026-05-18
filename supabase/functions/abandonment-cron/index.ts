// Supabase Edge Function — runs at 14:05 SAST (12:05 UTC) daily
// Processes abandoned fixtures: awards auto-wins/losses, flags 3+ abandon teams

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const today = new Date().toISOString().split('T')[0]

  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select(`
      id,
      home_team_id,
      away_team_id,
      waiting_reports ( reported_by_team_id )
    `)
    .eq('scheduled_date', today)
    .eq('status', 'scheduled')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const processed: string[] = []
  const errors: string[] = []

  for (const fixture of fixtures ?? []) {
    const reporters = new Set(
      (fixture.waiting_reports as { reported_by_team_id: string }[])
        ?.map((r) => r.reported_by_team_id) ?? []
    )

    const homeReported = reporters.has(fixture.home_team_id)
    const awayReported = reporters.has(fixture.away_team_id)

    let abandonedType: string
    let homeScore: number
    let awayScore: number

    if (homeReported && !awayReported) {
      // Away abandoned → away gets loss, home gets win
      abandonedType = 'away'
      homeScore = 3
      awayScore = 0
    } else if (awayReported && !homeReported) {
      // Home abandoned → home gets loss, away gets win
      abandonedType = 'home'
      homeScore = 0
      awayScore = 3
    } else if (!homeReported && !awayReported) {
      // Neither showed → 0-0, no points
      abandonedType = 'both'
      homeScore = 0
      awayScore = 0
    } else {
      // Both reported waiting = both showed up, skip
      continue
    }

    const { error: resultError } = await supabase.from('results').insert({
      fixture_id: fixture.id,
      home_score: homeScore,
      away_score: awayScore,
      is_abandoned: true,
      abandoned_type: abandonedType,
    })

    if (resultError) {
      errors.push(`${fixture.id}: ${resultError.message}`)
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
      details: {
        abandoned_type: abandonedType,
        home_team_id: fixture.home_team_id,
        away_team_id: fixture.away_team_id,
      },
    })

    processed.push(fixture.id)
  }

  // Flag teams with 3+ abandonments to all admins
  const { data: flaggedTeams } = await supabase
    .from('teams')
    .select('id, name, abandon_count, profiles!manager_id(id, username)')
    .gte('abandon_count', 3)

  for (const team of flaggedTeams ?? []) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    for (const admin of admins ?? []) {
      const manager = (team.profiles as { username: string } | null)
      await supabase.from('notifications').insert({
        user_id: admin.id,
        type: 'team_request',
        title: '⚠️ 3+ Abandonments',
        body: `${manager?.username ?? team.name} has ${team.abandon_count} abandonments — review for sacking`,
        data: { team_id: team.id },
      })
    }
  }

  return Response.json({
    processed: processed.length,
    errors,
    flagged: flaggedTeams?.length ?? 0,
  })
})
