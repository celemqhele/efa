import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscription = await request.json()
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  // Upsert by endpoint — re-uses existing row if already registered
  await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, subscription },
      { onConflict: 'subscription->endpoint' as any, ignoreDuplicates: false }
    )

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await request.json()
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .filter('subscription->>endpoint', 'eq', endpoint)

  return NextResponse.json({ ok: true })
}
