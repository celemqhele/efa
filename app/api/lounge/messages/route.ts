import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel_id, content, gif_url } = await request.json()
  if (!channel_id || (!content?.trim() && !gif_url)) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('channel_messages')
    .insert({
      channel_id,
      sender_id: user.id,
      content: content?.trim() || null,
      gif_url: gif_url || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
