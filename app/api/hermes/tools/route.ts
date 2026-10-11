import { NextRequest, NextResponse } from 'next/server'
import { validateAuthTicket, hashRequest } from '@/lib/auth-ticket'
import { createAdminClient } from '@/lib/supabase/server'
import { normalizePhoneDigits } from '@/lib/phone'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const code = req.headers.get('x-auth-code') || body.authCode
    const actorPhone = req.headers.get('x-actor-phone') || body.actorPhone
    const tool = body.tool || ''
    const args = body.args || {}
    if (!code || !actorPhone) return NextResponse.json({ error: 'missing_auth' }, { status: 401 })
    const v = await validateAuthTicket(code, actorPhone, hashRequest(JSON.stringify({ tool, args })), { tool })
    if (!v?.ok) return NextResponse.json({ error: v?.reason || 'invalid_ticket' }, { status: 403 })

    const supabase = await createAdminClient()
    if (tool === 'league_facts') {
      return NextResponse.json({ ok: true, facts: 'league_facts_placeholder' })
    }
    if (tool === 'match_link_get') {
      const { data } = await supabase
        .from('fixtures')
        .select('id, home_team_id, away_team_id, scheduled_date, match_codes(code)')
        .limit(5)
      return NextResponse.json({ ok: true, fixtures: data })
    }
    if (tool === 'onboarding') {
      return NextResponse.json({ ok: true, onboarding: 'ok' })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
