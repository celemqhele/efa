import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createAdminClient()
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('manager_availability')
    .upsert(body)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
