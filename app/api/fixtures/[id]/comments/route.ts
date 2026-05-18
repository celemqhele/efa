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

  let body: { content: string; parent_id?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { content, parent_id } = body

  if (!content || content.trim().length === 0) {
    return Response.json({ error: 'content is required' }, { status: 400 })
  }

  const { data: comment, error: insertError } = await supabase
    .from('comments')
    .insert({
      fixture_id,
      user_id: user.id,
      content: content.trim(),
      parent_id: parent_id ?? null,
    })
    .select('id, fixture_id, user_id, parent_id, content, created_at')
    .single()

  if (insertError || !comment) {
    return Response.json(
      { error: insertError?.message ?? 'Failed to insert comment' },
      { status: 500 }
    )
  }

  return Response.json(comment, { status: 201 })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { id: fixture_id } = await params

  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      id,
      fixture_id,
      user_id,
      parent_id,
      content,
      created_at,
      author:profiles!comments_user_id_fkey(id, username, avatar_url)
    `)
    .eq('fixture_id', fixture_id)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(comments ?? [])
}
