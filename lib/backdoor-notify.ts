import type { SupabaseClient } from '@supabase/supabase-js'
import { insertNotificationsAndPush, notifyAllAdmins } from '@/lib/notify'
import { sendAdminPush } from '@/lib/push'

function teamName(t: any): string | null {
  if (Array.isArray(t)) return t[0]?.name ?? null
  return t?.name ?? null
}

function teamManagerId(t: any): string | null {
  if (Array.isArray(t)) return t[0]?.manager_id ?? null
  return t?.manager_id ?? null
}

// Backdoor submitted → browser notification + push for every admin.
// The admin review page (/admin/backdoor-submissions) is the deep link.
export async function notifyBackdoorSubmitted(
  supabase: SupabaseClient,
  args: {
    submissionId: string
    fixtureId: string
    nonRespondingSide: 'home' | 'away'
    homeName: string
    awayName: string
  }
) {
  const { submissionId, fixtureId, nonRespondingSide, homeName, awayName } = args
  const nonRespondingName = nonRespondingSide === 'home' ? homeName : awayName
  await notifyAllAdmins(supabase, {
    type: 'backdoor_submitted',
    title: 'Backdoor Submission',
    body: `${homeName} vs ${awayName} — ${nonRespondingName} reported as not responding.`,
    data: { fixture_id: fixtureId, submission_id: submissionId, url: '/admin/backdoor-submissions' },
    push_url: '/admin/backdoor-submissions',
  })
}

// Backdoor approved/declined → notify the reporting manager only.
// The submitter answers "who is NOT responding" (side_claimed), so the reporter is
// always the manager of the team OPPOSITE side_claimed.
export async function notifyBackdoorDecision(
  supabase: SupabaseClient,
  submissionIds: string[],
  outcome: 'approved' | 'declined'
) {
  if (!submissionIds.length) return

  const { data: submissions } = await supabase
    .from('backdoor_submissions')
    .select('id, fixture_id, side_claimed')
    .in('id', submissionIds) as any

  if (!submissions?.length) return

  const fixtureIds = [...new Set(submissions.map((s: any) => s.fixture_id))]
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, status,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .in('id', fixtureIds) as any

  const fixtureById = new Map<string, any>(
    (fixtures ?? []).map((f: any) => [f.id, f])
  )

  const rows: any[] = []
  for (const s of submissions ?? []) {
    const f = fixtureById.get(s.fixture_id)
    if (!f) continue
    const homeName = teamName(f.home_team)
    const awayName = teamName(f.away_team)
    const reporterId = s.side_claimed === 'home' ? teamManagerId(f.away_team) : teamManagerId(f.home_team)
    if (!reporterId) continue
    rows.push({
      user_id: reporterId,
      type: outcome === 'approved' ? 'backdoor_approved' : 'backdoor_declined',
      title: outcome === 'approved' ? 'Backdoor Approved' : 'Backdoor Declined',
      body: `${homeName} vs ${awayName} — your backdoor claim was ${outcome}.`,
      data: { fixture_id: s.fixture_id },
    })
  }

  if (rows.length) {
    await insertNotificationsAndPush(supabase, rows)
  }

  // On approval the fixture flips to confirmed (DB trigger inserts in-app admin
  // rows); the admin browser push is handled here.
  if (outcome === 'approved') {
    const f = fixtures?.[0]
    if (f) {
      await sendAdminPush(supabase, {
        title: 'Backdoor Approved',
        body: `${teamName(f.home_team) ?? 'Home'} vs ${teamName(f.away_team) ?? 'Away'} — result confirmed.`,
        url: `/fixtures/${f.id}`,
        tag: 'backdoor-approved',
      }).catch(() => {})
    }
  }
}

// Push-only admin alert when a result is confirmed (in-app rows already come
// from the on_fixture_confirmed DB trigger, so we don't insert duplicates).
export async function notifyAdminsOfResult(supabase: SupabaseClient, fixtureId: string) {
  const { data: fixture } = await supabase
    .from('fixtures')
    .select(`
      id,
      home_team:teams!fixtures_home_team_id_fkey(name),
      away_team:teams!fixtures_away_team_id_fkey(name),
      result:results(home_score, away_score)
    `)
    .eq('id', fixtureId)
    .single() as any

  const r = Array.isArray(fixture?.result) ? fixture.result[0] : fixture?.result
  if (!fixture || !r) return

  await sendAdminPush(supabase, {
    title: 'Result Confirmed',
    body: `${teamName(fixture.home_team) ?? 'Home'} ${r.home_score}–${r.away_score} ${teamName(fixture.away_team) ?? 'Away'}`,
    url: `/fixtures/${fixtureId}`,
    tag: 'result-confirmed',
  }).catch(() => {})
}
