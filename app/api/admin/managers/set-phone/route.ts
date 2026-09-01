import { createClient, createAdminClient } from '@/lib/supabase/server'
import { waDigits } from '@/lib/phone'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, phone } = await request.json()
  if (!user_id) return Response.json({ error: 'user_id is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()
  const clean = phone ? waDigits(String(phone)) : null

  const { error } = await (adminSupabase as any)
    .from('profiles')
    .update({ phone: clean || null })
    .eq('id', user_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, phone: clean || null })
}