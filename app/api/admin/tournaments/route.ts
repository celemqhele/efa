import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createAdminClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .order('created_at', { ascending: false })

  return NextResponse.json(tournaments ?? [])
}
