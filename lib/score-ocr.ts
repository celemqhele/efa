// Server-only OCR for the submit-match proof screenshot.
//
// One job: transcribe the TOP BAND of an eFootball screenshot (where the
// scoreline lives) as fast as possible. No AI, no third-party network: the
// English traineddata is bundled in `assets/ocr` and read from disk, because
// tesseract.js otherwise downloads it from jsDelivr on every cold start (Vercel's
// working directory is read-only, so its own cache write silently fails).
//
// The crop bands and preprocessing below are not guesses: they were tuned on 30
// real production screenshots pulled from the match-screenshots bucket. A single
// full-frame OCR pass misses the scoreline on stylized eFootball glyphs, while a
// tight top band reads "Hungry Lions 1 = 4 Cape Town City" cleanly. The first
// two passes (TIGHT, WIDE) are the fast path; the extra two only run when the
// first pair found nothing.

import path from 'node:path'
import os from 'node:os'

const ASSET_DIR = path.join(process.cwd(), 'assets', 'ocr')

// A single tesseract worker is reused for the whole lambda instance: spawning a
// worker (and loading the 5MB model) per screenshot was the slow part.
type Worker = Awaited<ReturnType<typeof import('tesseract.js').createWorker>>
let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker('eng', undefined, {
        langPath: ASSET_DIR,
        // Writable scratch dir for the instance, so a warm lambda does not
        // re-read the model off the bundle for every submission.
        cachePath: path.join(os.tmpdir(), 'efa-tesseract'),
        gzip: false,
        logger: () => {},
      } as any)
    })().catch((e) => {
      // Never cache a rejected init: the next request gets a fresh attempt.
      workerPromise = null
      throw e
    })
  }
  return workerPromise
}

type Variant = {
  top: number
  height: number
  x0: number
  x1: number
  scale: number
  mode: 'threshold' | 'normalize'
  psm: string
}

// TIGHT: the scoreline band on most result screens. Cleanest read.
// WIDE: catches scoreboards that sit lower / full-width, sparse-text mode.
// BAND/FULL: escalation only, for the captures TIGHT and WIDE cannot read.
const TIGHT: Variant = { top: 0.05, height: 0.25, x0: 0.10, x1: 0.90, scale: 2, mode: 'threshold', psm: '6' }
const WIDE: Variant = { top: 0, height: 0.45, x0: 0, x1: 1, scale: 2, mode: 'threshold', psm: '11' }
const BAND: Variant = { top: 0, height: 0.35, x0: 0, x1: 1, scale: 1.5, mode: 'normalize', psm: '6' }
const LOW: Variant = { top: 0.15, height: 0.35, x0: 0.05, x1: 0.95, scale: 2.5, mode: 'threshold', psm: '6' }

const FIRST_PASSES = [TIGHT, WIDE]
const ESCALATION_PASSES = [BAND, LOW]

export type ScoreOcrRead = {
  /** Concatenated text of every pass that ran, for the "what we read" panel. */
  text: string
  /** True when at least one pass completed (false = OCR itself failed). */
  completed: boolean
  /** Wall time spent on this image. */
  ms: number
}

async function crop(buffer: Buffer, v: Variant): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 1920
  const h = meta.height ?? 1080
  const cw = Math.max(1, Math.round(w * (v.x1 - v.x0)))
  const ch = Math.max(1, Math.round(h * v.height))

  let s = sharp(buffer)
    .extract({ left: Math.round(w * v.x0), top: Math.round(h * v.top), width: cw, height: ch })
    .resize({ width: Math.min(3200, Math.round(cw * v.scale)), withoutEnlargement: false })
    .greyscale()
    .normalize()
    .sharpen()

  if (v.mode === 'threshold') s = s.threshold(150)
  return s.png().toBuffer()
}

/**
 * Read the top band of one screenshot.
 *
 * `hasMatch(passTexts)` lets the caller stop the escalation ladder as soon as a
 * usable scoreline was found, which keeps the common case at two passes.
 * Every pass is clamped to `deadline` so a stalled recognition can never wedge
 * the request; whatever text was collected is returned either way.
 */
export async function readScoreBand(
  buffer: Buffer,
  deadline: number,
  hasMatch: (text: string) => boolean,
): Promise<ScoreOcrRead> {
  const startedAt = Date.now()
  const texts: string[] = []
  let completed = false

  try {
    const worker = await getWorker()

    const run = async (v: Variant) => {
      if (Date.now() >= deadline) return
      const img = await crop(buffer, v)
      await worker.setParameters({ tessedit_pageseg_mode: v.psm } as any)
      const { data } = await worker.recognize(img)
      const text = String(data.text || '').trim()
      if (text) texts.push(text)
      completed = true
    }

    for (const v of FIRST_PASSES) {
      await run(v)
      if (hasMatch(texts.join('\n'))) {
        return { text: texts.join('\n'), completed, ms: Date.now() - startedAt }
      }
    }
    for (const v of ESCALATION_PASSES) {
      await run(v)
      if (hasMatch(texts.join('\n'))) break
    }
  } catch (e) {
    console.error('[score-ocr] read failed:', e)
  }

  return { text: texts.join('\n'), completed, ms: Date.now() - startedAt }
}
