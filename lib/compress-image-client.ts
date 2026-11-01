// Client-side screenshot compression for the submit-match portal.
//
// The result form accepts up to 4 screenshots (1 required + 3 for games that
// had to be replayed because of network drops). A phone's PNG screenshots are
// 3-8MB each, and a Route Handler on Vercel rejects a request body over ~4.5MB
// BEFORE Next.js ever sees it: the edge answers
// `413 Request Entity Too Large FUNCTION_PAYLOAD_TOO_LARGE`, and depending on
// the browser that surfaces as a bare `TypeError: Failed to fetch` (the portal
// used to report that as "check your connection"). So the whole MULTI-FILE
// payload has to stay well under that cap, not just each individual file: four
// "1.2MB each" files are 4.8MB together, which is exactly how a 4-screenshot
// submission could still be rejected even though every file passed its own
// check.
//
// `fitScreenshots()` is the multi-file entry point: it divides one shared
// budget across the files (fair share first, then the leftovers go to the
// bigger files) so 1 screenshot keeps full quality while 4 screenshots shrink
// enough to travel together. The single-file `maybeCompressImage()` is still
// exported for the smaller spots (backdoor / dispute proof).
//
// The encoder steps down through a short ladder (edge 1600 then 1280, quality
// 0.8 then 0.7). A screenshot is proof plus OCR input, so 1280px / q0.7 is
// still plenty readable; the goal is never to lose a submission to the body
// limit. Files already small enough pass through byte-identical so the proof
// keeps its original bytes.
//
// Browser only (Canvas + createImageBitmap). Never throws: if the format or the
// browser cannot handle it, the original File is returned so the CALLER can
// decide (and tell the manager) when it still does not fit.

// The platform edge rejects a request body around 4.5MB. Everything in the
// portal's result POST (screenshots + text fields + multipart boundaries) must
// fit under it, so the screenshots share one budget with headroom to spare.
export const TOTAL_PAYLOAD_BUDGET = 3_200_000 // 3.2MB across every attached screenshot

// No single screenshot may take the whole budget: with 4 files attached the
// fair share is 800KB, and a file that refuses to shrink must not starve the
// other three.
export const MAX_FILE_BYTES = 1_100_000 // 1.1MB

const MAX_EDGE = 1600
const QUALITY = 0.8

// (edge, quality) attempts, largest/cleanest first.
const LADDER: Array<{ edge: number; quality: number }> = [
  { edge: MAX_EDGE, quality: QUALITY },
  { edge: MAX_EDGE, quality: 0.7 },
  { edge: 1280, quality: 0.75 },
  { edge: 1280, quality: 0.65 },
  { edge: 1080, quality: 0.6 },
]

export async function maybeCompressImage(file: File, maxBytes = MAX_FILE_BYTES): Promise<File> {
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

export type FitResult = {
  files: File[]
  /** Sum of the produced file sizes, in bytes. */
  bytes: number
  /**
   * Files that could not be brought under their share even at the bottom of the
   * quality ladder (e.g. a format this browser cannot decode). The caller must
   * not POST them as-is: the platform would reject the whole request.
   */
  tooBig: string[]
}

/**
 * Fit every screenshot the manager attached into ONE shared byte budget.
 *
 * Pass 1 gives each file its fair share of the total budget (never more than
 * `maxFileBytes`). Pass 2 re-splits what the smaller files did not use across
 * the ones that were still over their share. Whatever is still over its share
 * afterwards is reported in `tooBig` so the UI can ask for fewer screenshots
 * instead of letting the platform drop the request.
 */
export async function fitScreenshots(files: File[], opts: { totalBudget?: number; maxFileBytes?: number } = {}): Promise<FitResult> {
  const totalBudget = opts.totalBudget ?? TOTAL_PAYLOAD_BUDGET
  const maxFileBytes = opts.maxFileBytes ?? MAX_FILE_BYTES
  if (files.length === 0) return { files, bytes: 0, tooBig: [] }

  const shared = Math.max(Math.floor(totalBudget / files.length), 120_000)
  const share = Math.min(shared, maxFileBytes)

  // Pass 1: each file to its own share.
  let out = await Promise.all(files.map((f) => maybeCompressImage(f, share)))

  // Pass 2: hand the unused headroom to the files that still exceed their share.
  let used = out.reduce((n, f) => n + f.size, 0)
  const over = out.map((f, i) => (f.size > share ? i : -1)).filter((i) => i >= 0)
  if (over.length > 0 && used < totalBudget) {
    const spare = totalBudget - used
    const perOver = Math.min(maxFileBytes, Math.floor(spare / over.length) + share)
    out = await Promise.all(out.map((f, i) => (over.includes(i) ? maybeCompressImage(f, perOver) : f)))
    used = out.reduce((n, f) => n + f.size, 0)
  }

  const tooBig = out
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => used > totalBudget && f.size > share)
    .map(({ f }) => f.name)

  return { files: out, bytes: used, tooBig: used > totalBudget ? tooBig : [] }
}
