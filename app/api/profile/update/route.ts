import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { waDigits, isValidStoredPhone } from '@/lib/phone'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { playstyle, phone } = body

  const updates: Record<string, any> = {}
  if (playstyle !== undefined) updates.playstyle = playstyle
  if (phone !== undefined) {
    const clean = phone ? waDigits(String(phone)) : null
    if (clean && !isValidStoredPhone(clean)) {
      return NextResponse.json({ error: 'Invalid phone number — check you have the full number with the country code.' }, { status: 400 })
    }
    updates.phone = clean
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  if (updates.phone !== undefined) {
    await (adminSupabase as any).from('audit_log').insert({
      admin_id: null,
      action: 'update_phone',
      target_type: 'profile',
      target_id: user.id,
      details: { phone: updates.phone, note: 'Phone updated by user via profile page' },
    })
  }

  const { error } = await adminSupabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
