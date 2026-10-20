// Client-side screenshot compression for the submit-match portal.
//
// The result form accepts up to 4 screenshots (1 required + 3 for games that
// had to be replayed because of network drops). A phone's PNG screenshots are
// 3-8MB each, and a Route Handler on Vercel rejects a request body over ~4.5MB
// BEFORE Next.js ever sees it — the browser then reports the bare "Failed to
// fetch" the portal used to show. So every picked file has to land in a small
// per-file budget: `MAX_BYTES` (1.2MB), which keeps 4 files comfortably under
// the platform cap.
//
// The encoder steps down through a short ladder (edge 1600 then 1280, quality
// 0.8 then 0.7) and returns the first result that fits. A screenshot is proof
// plus AI-OCR input, so 1280px / q0.7 is still plenty readable; the goal is
// never to lose a submission to the body limit. Files already small enough pass
// through byte-identical so the proof keeps its original bytes.
//
// Browser only (Canvas + createImageBitmap). Never throws: if the format or the
// browser cannot handle it, the original File is returned.

const DEFAULT_MAX_BYTES = 1_200_000 // 1.2MB — 4 of these stay under the platform body cap
const DEFAULT_MAX_EDGE = 1600
const DEFAULT_QUALITY = 0.8

// (edge, quality) attempts, largest/cleanest first.
const LADDER: Array<{ edge: number; quality: number }> = [
  { edge: DEFAULT_MAX_EDGE, quality: DEFAULT_QUALITY },
  { edge: DEFAULT_MAX_EDGE, quality: 0.7 },
  { edge: 1280, quality: 0.75 },
  { edge: 1280, quality: 0.65 },
  { edge: 1080, quality: 0.6 },
]

export async function maybeCompressImage(
  file: File,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<File> {
  if (!file || !file.type.startsWith('image/')) return file
  if (file.size <= maxBytes) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)

    let best: File | null = null
    for (const { edge, quality } of LADDER) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) break
      ctx.drawImage(bitmap, 0, 0, w, h)

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size > 0) {
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
        const candidate = new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
        // Keep the smallest produced so far, and stop as soon as one fits the
        // budget (later rungs only get smaller, so this is the best quality that
        // satisfies the size cap).
        if (!best || candidate.size < best.size) best = candidate
        if (candidate.size <= maxBytes) break
      }
    }

    if (!best || best.size >= file.size) return file
    return best
  } catch (e) {
    console.warn('[portal] screenshot compression skipped:', e)
    return file
  } finally {
    bitmap?.close?.()
  }
}
