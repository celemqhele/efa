import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  const MAX_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 })
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `${user.id}/avatar.${ext}`

  const adminSupabase = await createAdminClient()

  // Delete old avatar if exists
  const { data: existing } = await adminSupabase.storage.from('avatars').list(user.id)
  if (existing && existing.length > 0) {
    await adminSupabase.storage.from('avatars').remove(existing.map((f) => `${user.id}/${f.name}`))
  }

  // Upload new avatar
  const { error: uploadError } = await adminSupabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true, contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = adminSupabase.storage.from('avatars').getPublicUrl(fileName)
  const avatarUrl = urlData?.publicUrl

  if (avatarUrl) {
    await adminSupabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)
  }

  return NextResponse.json({ avatar_url: avatarUrl })
}
