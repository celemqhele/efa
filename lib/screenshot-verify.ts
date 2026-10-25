// Server-only AI verification of the proof screenshots uploaded in the
// submit-match portal. Two-step Gemini (flash-lite) pipeline:
//
//   1. OCR task      — the vision model transcribes what it can read in the
//                      image and extracts the scoreline + stat table.
//   2. ASSESS task   — a second task is handed that OCR text (and the same
//                      image) and asked for a true/false: is this a screenshot
//                      of a match score, or anything else that indicates a
//                      game score with stats? Even blurry counts.
//
// The verdict is then checked against the score the manager TYPED (1 goal of
// slack per side, either orientation — a replayed/rotated screenshot must not
// get a legit submission declined), and the stat tables of every screenshot
// are merged into one set for the fixture page.
//
// Design rule: this must NOT produce false declines. A score the vision reader
// actually saw is never overruled by the assessment step, a screenshot that
// cannot be read is skipped instead of failing the submission, and any Gemini
// error fails the check OPEN (submission goes through, just without stats).
//
// NOT 'use server': exports sync helpers too, and the portal route imports it.

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent'

// Slack allowed between the score the manager typed and the score a screenshot
// reads, PER SIDE: a 1-goal difference is fine (OCR slip, screenshot taken
// before the last goal, a corrected typo), anything bigger is a different game.
const GOAL_TOLERANCE = 1

// Most screenshots a manager attaches (1 required + up to 3 for replays).
export const MAX_SHOTS = 4

// Hard bounds on the AI side of the check. The route runs inside a 60s
// serverless function while the portal blocks on the POST, so a stalled Gemini
// response (its 503 "high demand" replies can leave the connection hanging)
// must never eat that whole window: without these caps the request hit the
// platform limit and died as a 504 while the manager watched the "Checking
// your screenshots" overlay. Each attempt is capped, and the whole check shares
// one budget so it always answers (fail open) with time left to write the
// result.
const CALL_TIMEOUT_MS = 10_000
const VERIFY_BUDGET_MS = 30_000
const MIN_ATTEMPT_MS = 1_500

export type ShotImage = { buffer: Buffer; mimeType: string }

type VisionRead = {
  ocrText: string
  homeTeam: string | null
  awayTeam: string | null
  homeScore: number | null
  awayScore: number | null
  stats: Record<string, { home: number; away: number }> | null
  failed: boolean
}

type Assessment = {
  ok: boolean
  hasScore: boolean
  hasStats: boolean
  reason: string | null
  failed: boolean
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
  /** Full sentence for the red-X decline card. null when ok. */
  reason: string | null
  /** What Gemini read — shown on the decline card so the manager sees why. */
  ocrText: string
  /** Combined stats, already aligned to the typed home/away sides. */
  stats: Record<string, { home: number; away: number }> | null
  /** Score the closest screenshot showed (as read, before any flip). */
  seenScore: { home: number; away: number } | null
  /** True when the check could not be completed (or had nothing readable) and
   *  the submission was let through anyway rather than declined. */
  failOpen: boolean
  images: VerifyImageResult[]
}

const STAT_KEYS = [
  'possession', 'shots', 'shotsOnTarget', 'fouls', 'offsides', 'cornerKicks',
  'freeKicks', 'passes', 'successfulPasses', 'crosses', 'interceptions',
  'tackles', 'saves',
]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stripFences(text: string): string {
  const t = String(text).trim()
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return m ? m[1] : t
}

// One Gemini flash-lite call attempt, hard-capped in time. The abort signal
// covers the body read as well as the connect: a socket that opens but never
// answers is exactly what wedged the portal POST before.
type GeminiAttempt = { ok: true; json: any } | { ok: false; status: number; text: string }

async function geminiAttempt(parts: any[], timeoutMs: number): Promise<GeminiAttempt> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${GEMINI_API}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    })
    const raw = await res.text()
    if (!res.ok) return { ok: false, status: res.status, text: raw.slice(0, 200) }

    const json = JSON.parse(raw)
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Empty Gemini response')
    return { ok: true, json: JSON.parse(stripFences(text)) }
  } finally {
    clearTimeout(timer)
  }
}

// One Gemini call (JSON mode), with a single retry on rate limit — the free
// tier is what we are running on, and a 429 must not become a decline. Both
// attempts are clamped to whatever is left of the shared verification budget,
// so this can never outlive the request.
async function callGemini(parts: any[], deadline: number): Promise<any> {
  const attempt = () => {
    const left = Math.min(CALL_TIMEOUT_MS, deadline - Date.now())
    if (left < MIN_ATTEMPT_MS) throw new Error('Gemini check ran out of time')
    return geminiAttempt(parts, left)
  }

  let out: GeminiAttempt
  try {
    out = await attempt()
  } catch (e) {
    if (e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message))) {
      throw new Error('Gemini check timed out')
    }
    throw e
  }

  if (!out.ok && (out.status === 429 || out.status === 503)) {
    const left = deadline - Date.now()
    if (left > MIN_ATTEMPT_MS + 500) {
      await sleep(Math.max(0, Math.min(1200, left - MIN_ATTEMPT_MS)))
      out = await attempt()
    }
  }
  if (!out.ok) throw new Error(`Gemini failed (${out.status}): ${out.text}`)

  return out.json
}

const VISION_PROMPT = `You are reading a screenshot from the mobile game eFootball (a football/soccer match game).

STEP 1 — OCR. Transcribe, line by line, every piece of text you can actually read in this image: team names, the scoreline, the clock, stat labels and their numbers, popups, button labels. Only transcribe what is really in the image — never invent text. Put it in "ocrText".

STEP 2 — extract the match data from the pixels:
{
  "ocrText": "the transcription from step 1",
  "homeTeam": "team/player name on the left, or null",
  "awayTeam": "team/player name on the right, or null",
  "homeScore": number or null,
  "awayScore": number or null,
  "stats": {
    "possession": [home, away] or null,
    "shots": [home, away] or null,
    "shotsOnTarget": [home, away] or null,
    "fouls": [home, away] or null,
    "offsides": [home, away] or null,
    "cornerKicks": [home, away] or null,
    "freeKicks": [home, away] or null,
    "passes": [home, away] or null,
    "successfulPasses": [home, away] or null,
    "crosses": [home, away] or null,
    "interceptions": [home, away] or null,
    "tackles": [home, away] or null,
    "saves": [home, away] or null
  } or null if no stat table is visible
}

Rules:
- homeScore/awayScore are the two numbers of the scoreline. Use null for BOTH when no scoreline is visible at all (menus, live play with only a clock, training, anything else).
- The image may be blurry, rotated, cropped or a photo of a screen: read it as best you can. Never guess a digit you cannot read — use null.
- A stat value of 0 is only valid if you can clearly read a 0 for that side; otherwise null.
- Stat numbers are often LARGE (passes 180-270, successful passes 120-200); garbled reads drop trailing digits. Read digit by digit.
- If a stat table is partly cut off, only include the rows you can read.
- Respond with ONLY the JSON object, no other text.`

const ASSESS_PROMPT = (ocrText: string, visionScore: string, typed: string) => `You are given a screenshot from the football video game eFootball plus the OCR text extracted from it.

TASK: decide whether this is a screenshot of a MATCH SCORE — anything that indicates a football game's score (a scoreline, a full-time/result screen, a post-match statistics screen, a scoreboard HUD).

Return ok=true when ANY of these is true:
- a scoreline between two teams or players is visible (2-1, 0-0, 5-3 ...), even if it is small, blurry, cropped at the edge, rotated or partly covered
- a full-time / result / post-match statistics screen of a played match is visible, even if you cannot read every number
- a scoreboard or in-game HUD shows a running score
- the image or OCR text clearly belongs to a played football match and shows its score

Return ok=false ONLY when there is clearly NO score at all: main menus, squad/game-plan screens, transfers, a live match showing only a clock with no scoreline, training, loading screens, photos of something unrelated, chat screens.

Do NOT decline because the image is blurry, garbled, rotated, cropped, only shows part of the stat table, or because the OCR is poor. If you genuinely cannot tell, return ok=true with reason "unclear".

${
  visionScore
    ? `The OCR step already read this scoreline from the pixels: ${visionScore}. Only say ok=false if the image clearly is not a match score screen at all.\n`
    : ''
}The scoreline the manager typed for this match is ${typed}. That is only context — do not judge the numbers, only whether a score is shown.

Return ONLY this JSON:
{ "ok": true, "hasScore": true, "hasStats": true, "reason": "one short sentence" }

OCR text from step 1:
---
${ocrText || '(no text could be read)'}
---`

// ── Step 1: OCR + extraction ────────────────────────────────────────────────

async function readScreenshot(img: ShotImage, deadline: number): Promise<VisionRead> {
  const empty: VisionRead = {
    ocrText: '', homeTeam: null, awayTeam: null, homeScore: null, awayScore: null,
    stats: null, failed: true,
  }
  try {
    const json = await callGemini([
      { text: VISION_PROMPT },
      { inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.buffer.toString('base64') } },
    ], deadline)

    const stats: Record<string, { home: number; away: number }> = {}
    if (json.stats && typeof json.stats === 'object') {
      for (const key of STAT_KEYS) {
        const val = json.stats[key]
        if (Array.isArray(val) && val.length >= 2 && typeof val[0] === 'number' && typeof val[1] === 'number') {
          stats[key] = { home: val[0], away: val[1] }
        }
      }
    }

    const num = (v: any) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : null)
    return {
      ocrText: typeof json.ocrText === 'string' ? json.ocrText : '',
      homeTeam: typeof json.homeTeam === 'string' ? json.homeTeam : null,
      awayTeam: typeof json.awayTeam === 'string' ? json.awayTeam : null,
      homeScore: num(json.homeScore),
      awayScore: num(json.awayScore),
      stats: Object.keys(stats).length > 0 ? stats : null,
      failed: false,
    }
  } catch (e) {
    console.error('[verify] vision OCR failed:', e)
    return empty
  }
}

// ── Step 2: the assessment task (given the OCR text) ────────────────────────

async function assessScreenshot(
  img: ShotImage,
  read: VisionRead,
  typedHome: number,
  typedAway: number,
  deadline: number,
): Promise<Assessment> {
  const typed = `${typedHome}-${typedAway}`
  const visionScore =
    read.homeScore != null && read.awayScore != null ? `${read.homeScore}-${read.awayScore}` : ''
  try {
    const json = await callGemini([
      { text: ASSESS_PROMPT(read.ocrText, visionScore, typed) },
      { inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.buffer.toString('base64') } },
    ], deadline)
    return {
      ok: json.ok !== false,
      hasScore: json.hasScore === true || json.ok !== false,
      hasStats: json.hasStats === true,
      reason: typeof json.reason === 'string' && json.reason ? json.reason : null,
      failed: false,
    }
  } catch (e) {
    console.error('[verify] assessment failed:', e)
    // Fail OPEN: an unreadable check must never decline a real submission.
    return { ok: true, hasScore: false, hasStats: false, reason: null, failed: true }
  }
}

// Distance between the typed score and a seen one, in both orientations: a
// screenshot taken from the opponent's side shows the sides swapped (2-3 typed
// vs 3-2 on screen is the SAME game), so the better orientation wins.
function scoreDistance(typedHome: number, typedAway: number, seenHome: number, seenAway: number) {
  const straight = Math.max(Math.abs(typedHome - seenHome), Math.abs(typedAway - seenAway))
  const swapped = Math.max(Math.abs(typedHome - seenAway), Math.abs(typedAway - seenHome))
  return swapped < straight
    ? { dist: swapped, flipped: true }
    : { dist: straight, flipped: false }
}

function formatScore(home: number, away: number) {
  return `${home}-${away}`
}

// ── The whole check ─────────────────────────────────────────────────────────

export async function verifyScreenshots(
  images: ShotImage[],
  typedHome: number,
  typedAway: number,
): Promise<VerifyResult> {
  const startedAt = Date.now()
  // Shared deadline for every Gemini call in this check (see VERIFY_BUDGET_MS):
  // past it, an unreadable screenshot is simply skipped and the submission goes
  // through, instead of the platform killing the request.
  const deadline = startedAt + VERIFY_BUDGET_MS

  // Wave 1: OCR every screenshot (parallel, capped by how many were attached).
  const reads = await Promise.all(images.map((img) => readScreenshot(img, deadline)))

  // Wave 2: the assessment task for each readable screenshot.
  const assessments = await Promise.all(
    reads.map((read, i) =>
      read.failed ? Promise.resolve(null) : assessScreenshot(images[i], read, typedHome, typedAway, deadline),
    ),
  )

  const ocrText =
    reads
      .map((r, i) => `Screenshot ${i + 1}:\n${r.ocrText?.trim() || '(no text could be read)'}`)
      .join('\n\n')
      .slice(0, 1800) || ''

  // Everything unreadable (Gemini down / quota) — let the submission through
  // without stats rather than blocking a manager who has a real screenshot.
  if (reads.every((r) => r.failed)) {
    console.log('[verify] every screenshot unreadable -> fail open', `(${Date.now() - startedAt}ms)`)
    return {
      ok: true, reason: null, ocrText, stats: null, seenScore: null, failOpen: true,
      images: reads.map((_, i) => ({ index: i + 1, isScoreShot: false, score: null, note: 'could not be read' })),
    }
  }

  // Which screenshots count as "a screenshot of a score"?
  //  - a scoreline the vision reader actually saw always counts (the assessment
  //    step may rescue, never veto — a veto here is where false declines come from)
  //  - otherwise the assessment task decides, including the blurry/garbled cases
  type Candidate = {
    i: number
    read: VisionRead
    assessment: Assessment | null
    dist: number
    flipped: boolean
  }
  const perImage: VerifyImageResult[] = []
  const candidates: Candidate[] = []

  reads.forEach((read, i) => {
    const sawScore = read.homeScore != null && read.awayScore != null
    const assessment = assessments[i]
    const isScoreShot = !read.failed && (sawScore || assessment?.ok === true)
    perImage.push({
      index: i + 1,
      isScoreShot,
      score: sawScore ? { home: read.homeScore!, away: read.awayScore! } : null,
      note: read.failed ? 'could not be read' : assessment?.reason ?? null,
    })
    if (isScoreShot) {
      const seen = sawScore
        ? scoreDistance(typedHome, typedAway, read.homeScore!, read.awayScore!)
        : { dist: GOAL_TOLERANCE + 1, flipped: false } // no numbers to compare
      candidates.push({ i, read, assessment, dist: seen.dist, flipped: seen.flipped })
    }
  })

  const aiNote = (() => {
    const notes = perImage.filter((s) => !s.isScoreShot && s.note).map((s) => `Screenshot ${s.index}: ${s.note}`)
    return notes.length ? ` The AI saw: ${notes.join(' / ')}.` : ''
  })()

  // 1. Not a single screenshot shows a score -> decline (the user's rule: a
  //    visible score is the minimum requirement).
  if (!candidates.length) {
    const subject = images.length > 1 ? 'none of your screenshots include' : 'this screenshot does not include'
    console.log('[verify] declined: no score', `(${Date.now() - startedAt}ms)`)
    return {
      ok: false,
      reason: `Submission declined because ${subject} a score. Upload the final score screen, where the scoreline between the two teams is visible.${aiNote}`,
      ocrText,
      stats: null,
      seenScore: null,
      failOpen: false,
      images: perImage,
    }
  }

  // 2. Nothing readable enough to compare numbers with -> fail open (no stats).
  //    "A score is visible but every digit is unreadable" must not decline.
  const withNumbers = candidates.filter((c) => c.read.homeScore != null && c.read.awayScore != null)
  if (!withNumbers.length) {
    console.log('[verify] score visible but unreadable -> fail open', `(${Date.now() - startedAt}ms)`)
    return {
      ok: true, reason: null, ocrText, stats: null, seenScore: null, failOpen: true, images: perImage,
    }
  }

  // 3. Closest screenshot decides: 1 goal of slack per side (either
  //    orientation), otherwise the screenshot shows a different game.
  withNumbers.sort((a, b) => a.dist - b.dist || statCount(b.read) - statCount(a.read))
  const best = withNumbers[0]
  const bestScore = { home: best.read.homeScore!, away: best.read.awayScore! }

  if (best.dist > GOAL_TOLERANCE) {
    console.log('[verify] declined: score too different', {
      typed: [typedHome, typedAway], seen: [bestScore.home, bestScore.away],
    }, `(${Date.now() - startedAt}ms)`)
    return {
      ok: false,
      reason: `Submission declined because the score in your screenshot (${formatScore(bestScore.home, bestScore.away)}) is too different from the score you entered (${formatScore(typedHome, typedAway)}). Enter the score that is on the screenshot, or upload the screenshot of the game you actually submitted.${aiNote}`,
      ocrText,
      stats: null,
      seenScore: bestScore,
      failOpen: false,
      images: perImage,
    }
  }

  // 4. Accepted. Combine the stat tables of every screenshot that matches, the
  //    closest/most complete first, so one full stats set reaches the fixture
  //    page even when a manager had to replay the game.
  const combined: Record<string, { home: number; away: number }> = {}
  for (const c of withNumbers) {
    if (c.dist > GOAL_TOLERANCE || !c.read.stats) continue
    for (const [key, val] of Object.entries(c.read.stats)) {
      if (combined[key]) continue
      combined[key] = c.flipped ? { home: val.away, away: val.home } : { home: val.home, away: val.away }
    }
  }

  console.log('[verify] accepted', {
    shots: images.length,
    typed: [typedHome, typedAway],
    seen: [bestScore.home, bestScore.away],
    dist: best.dist,
    flipped: best.flipped,
    statKeys: Object.keys(combined),
  }, `(${Date.now() - startedAt}ms)`)

  return {
    ok: true,
    reason: null,
    ocrText,
    stats: Object.keys(combined).length > 0 ? combined : null,
    seenScore: bestScore,
    failOpen: false,
    images: perImage,
  }
}

function statCount(read: VisionRead) {
  return read.stats ? Object.keys(read.stats).length : 0
}
