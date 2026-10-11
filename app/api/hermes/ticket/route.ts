import { NextRequest, NextResponse } from 'next/server'
import { issueAuthTicket } from '@/lib/auth-ticket'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const ticket = await issueAuthTicket({
      model: body.model || 'unknown',
      request: body.request || '',
      user: body.user || '',
      loggedIn: !!body.loggedIn,
      actorPhone: body.actorPhone,
      intent: body.intent || 'read',
      scope: body.scope || {},
    })
    return NextResponse.json(ticket)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
