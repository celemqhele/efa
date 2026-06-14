import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { preset, customBgUrl, colors } = body

  // Validate preset if provided
  if (preset && preset !== 'custom') {
    const { getPresetById } = await import('@/lib/themes')
    if (!getPresetById(preset)) {
      return NextResponse.json({ error: 'Invalid preset' }, { status: 400 })
    }
  }

  const themePrefs: Record<string, unknown> = {}
  if (preset) themePrefs.preset = preset
  if (customBgUrl) themePrefs.customBgUrl = customBgUrl
  if (colors) themePrefs.colors = colors

  const { error } = await supabase
    .from('profiles')
    .update({ theme_preferences: themePrefs })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
