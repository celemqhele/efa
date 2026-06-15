import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createAdminClient()

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, type, status, settings')
      .eq('id', id)
      .single()
    return NextResponse.json({ tournament })
  }

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .order('created_at', { ascending: false })

  return NextResponse.json(tournaments ?? [])
}
