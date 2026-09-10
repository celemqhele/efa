import { createClient, createAdminClient } from '@/lib/supabase/server'
import { waDigits, isValidStoredPhone } from '@/lib/phone'

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

  if (clean && !isValidStoredPhone(clean)) {
    return Response.json({ error: 'Invalid phone number — check you have the full number with the country code.' }, { status: 400 })
  }

  const { error, data: current } = await (adminSupabase as any)
    .from('profiles')
    .select('phone')
    .eq('id', user_id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { error: updateError } = await (adminSupabase as any)
    .from('profiles')
    .update({ phone: clean || null })
    .eq('id', user_id)

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  await (adminSupabase as any).from('audit_log').insert({
    admin_id: user.id,
    action: 'update_phone',
    target_type: 'profile',
    target_id: user_id,
    details: { previous_phone: current?.phone ?? null, phone: clean || null, note: 'Phone updated via admin users/managers page' },
  })

  return Response.json({ ok: true, phone: clean || null })
}