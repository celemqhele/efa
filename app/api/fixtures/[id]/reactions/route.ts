import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: fixture_id } = await params

  let body: { emoji: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { emoji } = body

  if (!emoji) {
    return Response.json({ error: 'emoji is required' }, { status: 400 })
  }

  // Attempt to insert — if it conflicts (already exists), delete instead (toggle)
  const { error: insertError } = await supabase
    .from('reactions')
    .insert({ fixture_id, user_id: user.id, emoji })

  if (!insertError) {
    return Response.json({ action: 'added' })
  }

  // Unique constraint violation means reaction already exists — remove it
  if (insertError.code === '23505') {
    const { error: deleteError } = await supabase
      .from('reactions')
      .delete()
      .eq('fixture_id', fixture_id)
      .eq('user_id', user.id)
      .eq('emoji', emoji)

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 })
    }

    return Response.json({ action: 'removed' })
  }

  return Response.json({ error: insertError.message }, { status: 500 })
}
