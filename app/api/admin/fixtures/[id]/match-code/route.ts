import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Returns the match-centre code for a fixture (matching the code the webhook
// resolves when the manager sends "Hi MC-XXXXXXXX"). null when the fixture has
// no code yet (only possible for fixtures that predate the match_codes trigger).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminSupabase = await createAdminClient()
  const { data } = await adminSupabase
    .from('match_codes')
    .select('code')
    .eq('fixture_id', id)
    .maybeSingle()

  return NextResponse.json({ code: data?.code ?? null })
}