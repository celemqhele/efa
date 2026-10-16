import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { insertNotificationsAndPush } from '@/lib/notify'
import { APP_BASE, POSTPONE_RESPONSE_HOURS, labelDate } from '@/lib/submit-match'

// Daily (see vercel.json - the Hobby plan only allows one run per day). Any
// postponement request still 'pending' after
// POSTPONE_RESPONSE_HOURS (24) is auto-declined: the match stays on its
// original date, and the requester gets a browser push + in-app alert so they
// know the move never happened. No backdoor is filed here — only an explicit
// decline does that.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const cutoff = new Date(Date.now() - POSTPONE_RESPONSE_HOURS * 60 * 60 * 1000).toISOString()

  const { data: stale, error } = await supabase
    .from('postpone_requests')
    .select('id, fixture_id, requested_by, new_date, created_at')
    .eq('status', 'pending')
    .lt('created_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (stale ?? []) as any[]
  if (rows.length === 0) return NextResponse.json({ declined: 0 })

  const nowIso = new Date().toISOString()
  const { error: declineErr } = await supabase
    .from('postpone_requests')
    .update({ status: 'declined', responded_at: nowIso, updated_at: nowIso })
    .in('id', rows.map((r) => r.id))
  if (declineErr) return NextResponse.json({ error: declineErr.message }, { status: 500 })

  for (const r of rows) {
    try {
      const { data: fixture } = await supabase
        .from('fixtures')
        .select(`
          id,
          home_team:teams!fixtures_home_team_id_fkey(name),
          away_team:teams!fixtures_away_team_id_fkey(name)
        `)
        .eq('id', r.fixture_id)
        .maybeSingle()
      const homeName = teamName(fixture?.home_team)
      const awayName = teamName(fixture?.away_team)
      const matchLabel = `${homeName} vs ${awayName}`

      // Prefer the portal link (it carries the match code); fall back to the
      // fixture page if this fixture has no code on file.
      const { data: codeRow } = await supabase
        .from('match_codes')
        .select('code')
        .eq('fixture_id', r.fixture_id)
        .maybeSingle()
      const url = codeRow?.code ? `${APP_BASE}/submit-match/${codeRow.code}` : `/fixtures/${r.fixture_id}`

      if (r.requested_by) {
        await insertNotificationsAndPush(supabase, {
          user_id: r.requested_by,
          type: 'fixture_postponed',
          title: 'Postponement declined',
          body: `${matchLabel}: your opponent did not answer within ${POSTPONE_RESPONSE_HOURS} hours, so the move to ${labelDate(String(r.new_date).slice(0, 10))} was declined. The match stays on its original date.`,
          data: { fixture_id: r.fixture_id, url },
          push_url: url,
        })
      }

      await supabase.from('audit_log').insert({
        admin_id: null,
        action: 'postpone_request_expired',
        target_type: 'fixture',
        target_id: r.fixture_id,
        details: {
          request_id: r.id,
          new_date: r.new_date,
          requested_by: r.requested_by,
          auto_declined: true,
          responded_at: nowIso,
        },
      })
    } catch (e) {
      console.error('[expire-postpone] notify failed for request:', r.id, e)
    }
  }

  return NextResponse.json({ declined: rows.length })
}

function teamName(t: any): string {
  if (Array.isArray(t)) return t[0]?.name ?? 'Team'
  return t?.name ?? 'Team'
}
