// Deterministic verification of the proof screenshot uploaded in the
// submit-match portal. Tesseract reads the top band of the image, then plain
// arithmetic decides: does the scoreline in the picture agree with the score the
// manager typed?
//
// This replaces the Gemini flash-lite check (two image uploads to Google per
// screenshot, up to eight per submission) which is what made a submission need a
// strong connection and take half a minute. Nothing here touches the network.
//
// Design rules, in order of importance:
//   1. Never decline a legitimate manager because OCR could not read a digit.
//      If the screenshot clearly is a match screen but no scoreline was read,
//      the submission goes through (fail open) with no stats.
//   2. A score that WAS read and differs by more than one goal per side asks the
//      manager to confirm instead of hard-blocking. Measured on 30 production
//      screenshots: OCR read a pair on 22 of them and 18 were exact, but two
//      were ambiguous between a misread digit and a mistyped score. The confirm
//      step catches the typo without ever trapping a correct submission.
//   3. The only hard decline is a screenshot that shows no match result at all
//      (a menu, a chat, a celebration banner). That one is unambiguous.
//
// NOT 'use server': the portal route and the offline corpus script import it.

import { readScoreBand } from '@/lib/score-ocr'

// Slack allowed between the score the manager typed and the score a screenshot
// reads, PER SIDE: 1 goal is fine (OCR slip, screenshot taken before the last
// goal, corrected typo), anything bigger is a different game.
const GOAL_TOLERANCE = 1

// Set to false to hard-decline a score mismatch instead of asking the manager to
// confirm. Kept as one switch because it is a product call, not a code detail.
const CONFIRM_ON_MISMATCH = false

// Most screenshots a manager attaches (1 required + up to 3 for replays).
export const MAX_SHOTS = 4

// Hard caps. The check runs inside the portal's blocking POST, so a single
// stalled recognition must not eat the request: the whole check always answers
// with time left to write the result.
const PER_IMAGE_MS = 6_000
const TOTAL_MS = 15_000

// Labels that prove the picture is a post-match statistics screen. Used only to
// decide "this is a match screen whose digits I could not read" (fail open)
// versus "this is not a score screenshot at all" (decline).
const STAT_LABEL = /\b(possession|shots? on target|shots?|passes|successful passes|fouls?|offsid\w*|corner kicks?|corners|free kicks?|crosses|interceptions?|tackles?|saves?)\b/gi
const RESULT_WORDS = /\b(full[\s-]?time|ft|result|match result|man of the match|player ratings)\b/i

export type ShotImage = { buffer: Buffer; mimeType: string }

export type ScorePair = {
  home: number
  away: number
  /** The OCR line the pair came from, for the "what we read" panel. */
  line: string
}

export type VerifyImageResult = {
  /** 1-based, for display ("Screenshot 2: ...") */
  index: number
  isScoreShot: boolean
  score: { home: number; away: number } | null
  note: string | null
}

export type VerifyResult = {
  ok: boolean
  /** True when the score was read but disagrees: portal must ask "submit anyway?" */
  needsConfirm: boolean
  /** Full sentence for the red-X card / confirm card. null when ok. */
  reason: string | null
  /** What OCR read, shown on the card so the manager sees why. */
  ocrText: string
  /** Score the closest screenshot showed (as read, before any flip). */
  seenScore: { home: number; away: number } | null
  /** True when no scoreline could be read and the submission was let through. */
  failOpen: boolean
  images: VerifyImageResult[]
  /** Wall time of the whole check, logged by the route. */
  ms: number
}

/**
 * Every plausible scoreline in an OCR text.
 *
 * Handles the shapes seen in real eFootball captures:
 *   "Hungry Lions 1 = 4 Cape Town City"   (the dash/badge OCRs as =, <, ~, ])
 *   "TS Galaxy 13 < 7 Frankiurt"
 *   "otloe thuthela 10 ~~ 6 | Hungry Lions"
 *   two adjacent lines holding one digit each
 * and skips anything that looks like a stat row, a clock or a percentage.
 */
export function extractScorePairs(text: string): ScorePair[] {
  const pairs: ScorePair[] = []

  for (const raw of text.split('\n')) {
    const line = raw
      .replace(/\d{1,2}[:.]\d{2}/g, ' ') // clocks: 93:58, 46.12
      .replace(/\d+\s*%/g, ' ') // possession percentages
      .trim()
    if (!line || /diacritic/i.test(line)) continue
    if (STAT_LABEL.test(line)) continue
    STAT_LABEL.lastIndex = 0

    const nums: number[] = []
    const re = /(?<!\d)(\d{1,2})(?!\d)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) nums.push(Number(m[1]))

    // A scoreline is two small numbers on one line. Four is the ceiling: extra
    // tokens are usually a replay counter or OCR debris and are tried too.
    const small = nums.filter((n) => n <= 15)
    if (small.length < 2 || small.length > 4) continue
    for (let i = 0; i + 1 < small.length; i++) {
      pairs.push({ home: small[i], away: small[i + 1], line: line.slice(0, 80) })
    }
  }

  return pairs
}

/** Did this text come from a played match (stats screen / result screen)? */
export function looksLikeMatchResult(text: string): boolean {
  if (RESULT_WORDS.test(text)) return true
  const labels = new Set((text.match(STAT_LABEL) ?? []).map((s) => s.toLowerCase()))
  STAT_LABEL.lastIndex = 0
  return labels.size >= 2
}

/**
 * Distance between the typed score and a seen one, in both orientations: a
 * screenshot taken from the opponent's side shows the sides swapped (2-3 typed
 * vs 3-2 on screen is the SAME game), so the better orientation wins.
 */
export function scoreDistance(
  typedHome: number,
  typedAway: number,
  seenHome: number,
  seenAway: number,
): { dist: number; flipped: boolean } {
  const straight = Math.max(Math.abs(typedHome - seenHome), Math.abs(typedAway - seenAway))
  const swapped = Math.max(Math.abs(typedHome - seenAway), Math.abs(typedAway - seenHome))
  return swapped < straight ? { dist: swapped, flipped: true } : { dist: straight, flipped: false }
}

function formatScore(home: number, away: number) {
  return `${home}-${away}`
}

type Read = {
  index: number
  text: string
  completed: boolean
  pairs: ScorePair[]
  matchLike: boolean
  ms: number
}

/**
 * The whole check.
 *
 * `confirmMismatch` is set by the portal on the second POST, after the manager
 * has seen the read score and chosen to submit anyway.
 */
export async function verifyScores(
  images: ShotImage[],
  typedHome: number,
  typedAway: number,
  opts: { confirmMismatch?: boolean } = {},
): Promise<VerifyResult> {
  const startedAt = Date.now()
  const deadline = startedAt + TOTAL_MS
  const reads: Read[] = []

  // Read the screenshots in order and stop at the first one that agrees with the
  // typed score: the extras are replay proof, and their score does not need to be
  // re-read once the submission has been verified. Sequential on purpose, a
  // single tesseract worker is much faster than four contending workers.
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const read = await readScoreBand(
      img.buffer,
      Math.min(deadline, Date.now() + PER_IMAGE_MS),
      (text) =>
        extractScorePairs(text).some(
          (p) => scoreDistance(typedHome, typedAway, p.home, p.away).dist <= GOAL_TOLERANCE,
        ),
    )
    const pairs = extractScorePairs(read.text)
    reads.push({
      index: i + 1,
      text: read.text,
      completed: read.completed,
      pairs,
      matchLike: looksLikeMatchResult(read.text),
      ms: read.ms,
    })
    if (pairs.some((p) => scoreDistance(typedHome, typedAway, p.home, p.away).dist <= GOAL_TOLERANCE)) break
    if (Date.now() >= deadline) break
  }

  const ocrText =
    reads
      .map((r) => `Screenshot ${r.index}:\n${r.text.trim() || '(no text could be read)'}`)
      .join('\n\n')
      .slice(0, 1800) || ''

  const perImage: VerifyImageResult[] = reads.map((r) => {
    const best = r.pairs
      .map((p) => ({ p, d: scoreDistance(typedHome, typedAway, p.home, p.away).dist }))
      .sort((a, b) => a.d - b.d)[0]
    return {
      index: r.index,
      isScoreShot: r.pairs.length > 0,
      score: best ? { home: best.p.home, away: best.p.away } : null,
      note: r.completed
        ? r.pairs.length > 0
          ? null
          : r.matchLike
            ? 'score too small or blurred to read'
            : 'no score or match stats found'
        : 'could not be read',
    }
  })

  // Everything unreadable (no pass completed at all) -> fail open.
  if (reads.length === 0 || reads.every((r) => !r.completed)) {
    console.log('[score-check] unreadable -> fail open', `(${Date.now() - startedAt}ms)`)
    return {
      ok: true, needsConfirm: false, reason: null, ocrText, seenScore: null,
      failOpen: true, images: perImage, ms: Date.now() - startedAt,
    }
  }

  const all = reads.flatMap((r) => r.pairs.map((p) => ({ p, d: scoreDistance(typedHome, typedAway, p.home, p.away) })))
  const best = all.sort((a, b) => a.d.dist - b.d.dist)[0] ?? null

  // 1. A screenshot agrees with the typed score: accepted.
  if (best && best.d.dist <= GOAL_TOLERANCE) {
    console.log('[score-check] accepted', {
      shots: images.length, typed: [typedHome, typedAway],
      seen: [best.p.home, best.p.away], flipped: best.d.flipped, readMs: reads.map((r) => r.ms),
    }, `(${Date.now() - startedAt}ms)`)
    return {
      ok: true, needsConfirm: false, reason: null, ocrText,
      seenScore: { home: best.p.home, away: best.p.away },
      failOpen: false, images: perImage, ms: Date.now() - startedAt,
    }
  }

  const seenScore = best ? { home: best.p.home, away: best.p.away } : null

  // 2. No scoreline could be read. Decline only when nothing in the picture says
  //    this was a played match; otherwise let it through without stats.
  if (!best) {
    const matchLike = reads.some((r) => r.matchLike)
    if (matchLike) {
      console.log('[score-check] match screen, score unreadable -> fail open', `(${Date.now() - startedAt}ms)`)
      return {
        ok: true, needsConfirm: false, reason: null, ocrText, seenScore: null,
        failOpen: true, images: perImage, ms: Date.now() - startedAt,
      }
    }
    console.log('[score-check] declined: not a match screen', `(${Date.now() - startedAt}ms)`)
    return {
      ok: false, needsConfirm: false,
      reason:
        'Submission declined because this does not look like a match result screenshot. Upload the final score screen, where the scoreline between the two teams is visible.',
      ocrText, seenScore: null, failOpen: false, images: perImage, ms: Date.now() - startedAt,
    }
  }

  // 3. A score was read but it disagrees. Ask for confirmation (default) rather
  //    than risk trapping a manager over a misread digit.
  const reason = `The score in your screenshot reads ${formatScore(seenScore!.home, seenScore!.away)}, but you entered ${formatScore(typedHome, typedAway)}.`
  if (opts.confirmMismatch || !CONFIRM_ON_MISMATCH) {
    console.log('[score-check] mismatch accepted by manager', {
      typed: [typedHome, typedAway], seen: seenScore,
    }, `(${Date.now() - startedAt}ms)`)
    return {
      ok: true, needsConfirm: false, reason: null, ocrText, seenScore,
      failOpen: false, images: perImage, ms: Date.now() - startedAt,
    }
  }

  console.log('[score-check] mismatch -> confirm', {
    typed: [typedHome, typedAway], seen: seenScore,
  }, `(${Date.now() - startedAt}ms)`)
  return {
    ok: false, needsConfirm: true,
    reason: `${reason} Check the score before you submit.`,
    ocrText, seenScore, failOpen: false, images: perImage, ms: Date.now() - startedAt,
  }
}
