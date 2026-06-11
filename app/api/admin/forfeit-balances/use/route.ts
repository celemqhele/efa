import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = await createAdminClient()
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile as any).role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { balance_id } = await request.json()
  if (!balance_id) {
    return Response.json({ error: 'balance_id is required' }, { status: 400 })
  }

  const { data: balance, error: fetchError } = await supabaseAdmin
    .from('forfeit_balances')
    .select('id, remaining')
    .eq('id', balance_id)
    .single()

  if (fetchError || !balance) {
    return Response.json({ error: 'Forfeit balance not found' }, { status: 404 })
  }

  if ((balance as any).remaining <= 0) {
    return Response.json({ error: 'Forfeit balance already exhausted' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('forfeit_balances')
    .update({ remaining: (balance as any).remaining - 1 })
    .eq('id', balance_id)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  return Response.json({ success: true, remaining: (balance as any).remaining - 1 })
}
