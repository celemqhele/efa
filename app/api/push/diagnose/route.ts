import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToUsers } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const serverPublicKey = process.env.VAPID_PUBLIC_KEY ?? ''
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Not logged in. Open this URL while logged into efa-fxyk.vercel.app in the same browser.' },
        { status: 401 }
      )
    }

  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, created_at')
    .eq('user_id', user.id)

  if (subErr) {
    return NextResponse.json({ ok: false, error: subErr.message }, { status: 500 })
  }

  if (!subs?.length) {
    return NextResponse.json({
      ok: false,
      error: 'No push subscriptions found for this account. Visit the site and tap "Allow" on the notification prompt first.',
    })
  }

  const results = await sendPushToUsers(supabase, [user.id], {
    title: 'EFA test push',
    body: 'If you can see this on your device, web push is working.',
    url: '/',
    tag: `diagnose-${Date.now()}`,
  })

  const detail = results.map((r, i) => {
    const row: any = subs[i]
    if (r.status === 'fulfilled') {
      return {
        endpoint: String(row.endpoint).slice(0, 46),
        created_at: row.created_at,
        sent: true,
      }
    }
    const err: any = r.reason
    return {
      endpoint: String(row.endpoint).slice(0, 46),
      created_at: row.created_at,
      sent: false,
      error: err?.message ?? String(err),
      statusCode: err?.statusCode ?? null,
      body: typeof err?.body === 'string' ? err.body.slice(0, 300) : null,
    }
  })

  return NextResponse.json({
    ok: true,
    user: user.id,
    subscriptionCount: subs.length,
    serverVapidPublicKey: serverPublicKey,
    results: detail,
  })
  } catch (e: any) {
    console.error('[push/diagnose] error:', e)
    return NextResponse.json({
      ok: false,
      thrown: true,
      error: e?.message ?? String(e),
      stack: e?.stack?.split('\n').slice(0, 6).join(' | ') ?? null,
    })
  }
}
