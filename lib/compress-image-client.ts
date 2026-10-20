// Client-side screenshot compression for the submit-match portal.
//
// The result form now accepts up to 4 screenshots (1 required + 3 for games
// that had to be replayed because of network drops). A phone's PNG screenshots
// are 3-8MB each, so four of them in one POST is far over the serverless body
// limit. Anything over `maxBytes` is downscaled to `maxEdge` on its long edge
// and re-encoded as JPEG at `quality` — still perfectly readable for both the
// AI check and the proof archive. Small files are passed through untouched so
// the proof keeps its original bytes.
//
// Browser only (Canvas + createImageBitmap). Never throws: if the format or
// the browser cannot handle it, the original File is returned.

const DEFAULT_MAX_BYTES = 1_000_000 // 1MB
const DEFAULT_MAX_EDGE = 1920
const DEFAULT_QUALITY = 0.9

export async function maybeCompressImage(
  file: File,
  maxBytes = DEFAULT_MAX_BYTES,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = DEFAULT_QUALITY,
): Promise<File> {
  if (!file || !file.type.startsWith('image/')) return file
  if (file.size <= maxBytes) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size === 0) return file
    // Only worth it if it actually shrank.
    if (blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch (e) {
    console.warn('[portal] screenshot compression skipped:', e)
    return file
  } finally {
    bitmap?.close?.()
  }
}
