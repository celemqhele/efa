// Client-side direct upload of portal screenshots to Supabase Storage.
//
// Going through our own Route Handler (POST /api/submit-match) means the whole
// multipart body has to fit under Vercel's ~4.5MB platform cap, which phone
// screenshots routinely exceed -> the edge drops the request and the browser
// surfaces a bare TypeError "Failed to fetch". Uploading the bytes straight to
// Supabase Storage (which has no such cap) and sending only the storage path to
// our route removes that limit entirely, so a screenshot can never fail to
// "reach the server" because of its size.
//
// Browser only. Compresses best-effort first (smaller uploads, less mobile data)
// but always falls back to the original file, so an unsupported format (e.g.
// HEIC) is still uploaded instead of being blocked.

import { createClient } from '@/lib/supabase/client'
import { maybeCompressImage, MAX_FILE_BYTES } from '@/lib/compress-image-client'

export async function uploadScreenshotToStorage(
  bucket: string,
  file: File,
  folder: string,
): Promise<string> {
  const toUpload = await maybeCompressImage(file, MAX_FILE_BYTES)
  const supabase = createClient()
  const ext = toUpload.type === 'image/png' ? 'png' : 'jpg'
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const { data, error } = await supabase.storage.from(bucket).upload(path, toUpload, {
    contentType: toUpload.type || 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  if (!data?.path) throw new Error('upload returned no path')
  return data.path
}
