import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    team_id: string
    primary_profile: string
    primary_level: string
    primary_score: number
    secondary_profile?: string | null
    secondary_level?: string | null
    secondary_score?: number
    tertiary_profile?: string | null
    tertiary_level?: string | null
    tertiary_score?: number
    notes?: string | null
  }

  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.team_id || !body.primary_profile) {
    return NextResponse.json({ error: 'team_id and primary_profile are required' }, { status: 400 })
  }

  const db = await createAdminClient()
  const { error } = await db.from('team_dna').upsert({
    team_id: body.team_id,
    primary_profile: body.primary_profile,
    primary_level: body.primary_level,
    primary_score: body.primary_score ?? 0,
    secondary_profile: body.secondary_profile ?? null,
    secondary_level: body.secondary_level ?? null,
    secondary_score: body.secondary_score ?? 0,
    tertiary_profile: body.tertiary_profile ?? null,
    tertiary_level: body.tertiary_level ?? null,
    tertiary_score: body.tertiary_score ?? 0,
    updated_by: user.id,
    notes: body.notes ?? null,
  }, { onConflict: 'team_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
