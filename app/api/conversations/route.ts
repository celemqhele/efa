import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/conversations — find or create a 1:1 conversation
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { other_user_id } = await request.json()
  if (!other_user_id || other_user_id === user.id) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
  }

  // Check both orderings (participant_1/2 have no guaranteed order)
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(participant_1.eq.${user.id},participant_2.eq.${other_user_id}),` +
      `and(participant_1.eq.${other_user_id},participant_2.eq.${user.id})`
    )
    .maybeSingle()

  if (existing) return NextResponse.json({ id: existing.id })

  // Create new
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ participant_1: user.id, participant_2: other_user_id })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: created.id })
}
