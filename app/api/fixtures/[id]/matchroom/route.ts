import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { matchroom_code } = await request.json()

  // Verify the user is the home team's manager for this fixture
  const { data: fixture } = await supabase
    .from('fixtures')
    .select('home_team_id, teams!fixtures_home_team_id_fkey(manager_id)')
    .eq('id', id)
    .single()

  const homeManagerId = (fixture as any)?.teams?.manager_id
  if (!fixture || homeManagerId !== user.id) {
    return NextResponse.json({ error: 'Only the home team manager can set the matchroom code' }, { status: 403 })
  }

  const { error } = await supabase
    .from('fixtures')
    .update({ matchroom_code: matchroom_code?.trim() || null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
