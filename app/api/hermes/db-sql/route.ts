import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { validateAuthTicket, hashRequest } from '@/lib/auth-ticket'
import { normalizePhoneDigits } from '@/lib/phone'
import { createAdminClient } from '@/lib/supabase/server'

function isFishy(sql: string): boolean {
  const s = sql.toLowerCase()
  if (s.includes('drop ') || s.includes('truncate ') || s.includes('alter ') || s.includes('create ')) return true
  if (s.includes('delete ') && !s.includes('where id=')) return true
  if (s.includes('update ') && (s.match(/update\s+\w+\s+set/gi)?.length || 0) > 0) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const code = req.headers.get('x-auth-code') || body.authCode
    const actorPhone = req.headers.get('x-actor-phone') || body.actorPhone
    const sql = body.sql || ''
    if (!code || !actorPhone) return NextResponse.json({ error: 'missing_auth' }, { status: 401 })
    const v = await validateAuthTicket(code, actorPhone, hashRequest(sql), { sql: sql.slice(0, 200) })
    if (!v?.ok) return NextResponse.json({ error: v?.reason || 'invalid_ticket' }, { status: 403 })

    const role = v.role
    const isRead = /^\s*select\b/i.test(sql)
    if (role !== 'admin' && !isRead) return NextResponse.json({ error: 'write_requires_admin_or_confirmation' }, { status: 403 })
    if (role !== 'admin' && isFishy(sql)) return NextResponse.json({ error: 'fishy_requires_admin_confirmation' }, { status: 403 })

    const supabase = await createAdminClient()
    await supabase.from('auth_ticket_audits').insert({
      ticket_id: null,
      action: 'db_sql',
      actor_phone: normalizePhoneDigits(actorPhone),
      details: { model: v.model, intent: v.intent, isRead, length: sql.length },
    })
    await supabase.from('audit_log').insert({
      action: 'hermes_db_sql',
      actor_type: 'system',
      actor_id: v.actor_user_id || null,
      entity_type: 'db',
      entity_id: null,
      details: { model: v.model, intent: v.intent, isRead },
    })

    const res = execSync(`npm run db -- -c "${sql.replace(/"/g, '\\"')}"`, { cwd: process.cwd(), timeout: 60000, encoding: 'utf8' })
    return NextResponse.json({ ok: true, result: res })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
