import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface ProfileInput {
  profile: string
  level: string
  score: number
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { team_id, primary, secondary, tertiary, notes } = body as {
      team_id: string
      primary: ProfileInput
      secondary?: ProfileInput | null
      tertiary?: ProfileInput | null
      notes?: string
    }

    if (!team_id || !primary?.profile || !primary?.level) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data: existing } = await supabase
      .from('team_dna')
      .select('id')
      .eq('team_id', team_id)
      .maybeSingle()

    const payload = {
      team_id,
      primary_profile: primary.profile,
      primary_level: primary.level,
      primary_score: primary.score ?? 0,
      secondary_profile: secondary?.profile ?? null,
      secondary_level: secondary?.level ?? null,
      secondary_score: secondary?.score ?? 0,
      tertiary_profile: tertiary?.profile ?? null,
      tertiary_level: tertiary?.level ?? null,
      tertiary_score: tertiary?.score ?? 0,
      notes: notes ?? null,
    }

    if (existing) {
      const { error } = await supabase
        .from('team_dna')
        .update(payload)
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('team_dna')
        .insert(payload)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('assign-dna error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
