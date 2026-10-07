'use server'

// Server-only OCR: vision-first pipeline + match_stats column mapping.
// Shared by the WhatsApp webhook and the submit-match portal so both run the
// exact same battle-tested reader.

import { analyzeScreenshot, cleanOcrText, cleanOcrWithGroq } from '@/lib/whatsapp'
import { parseScreenshot } from '@/lib/screenshot-parser'

export type ImageAnalysis = {
  homeTeam: string | null
  awayTeam: string | null
  homeScore: number | null
  awayScore: number | null
  matchStats: Record<string, { home: number; away: number }> | null
  invalidReason: string | null
}

// Labels from the eFootball stats table. When a manager screenshots only the
// bottom of that table there is no scoreboard in the picture at all, and both the
// vision model and the text LLM tend to grab one of these row labels and report it
// as a team name. Observed in the wild: "Score extracted: i L Free Kicks 0-3 ?".
const STAT_ROW_LABELS = [
  'successful passes', 'shots on target', 'possession', 'shots', 'fouls', 'fould',
  'offsides', 'offside', 'corner kicks', 'corners', 'free kicks', 'passes',
  'crosses', 'interceptions', 'tackles', 'saves',
]

// Individual words that make up those labels. Needed because "Free Kicks" splits
// into "free" + "kicks", neither of which is a label on its own.
const STAT_ROW_WORDS = new Set(
  STAT_ROW_LABELS.flatMap((label) => label.split(' '))
)

// True when a "team name" is really OCR debris or a stats-table row label. Keeps a
// cropped screenshot from being confirmed against invented clubs.
function isImplausibleTeamName(name: string | null | undefined): boolean {
  if (!name) return false
  const cleaned = name.replace(/[^a-z ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  if (cleaned.length < 3) return true
  if (STAT_ROW_LABELS.includes(cleaned)) return true
  // Anything left after discarding stat words and single-letter debris ("i L").
  const meaningful = cleaned
    .split(' ')
    .filter((w) => w.length > 2 && !STAT_ROW_WORDS.has(w))
  return meaningful.length === 0
}

export async function analyzeImageBuffer(buffer: Buffer, mimeType: string): Promise<ImageAnalysis> {
  const startedAt = Date.now()
  let ocrResult: Awaited<ReturnType<typeof parseScreenshot>> | null = null
  try { ocrResult = await parseScreenshot(buffer) } catch (e) { console.error('[ocr] tesseract failed:', e) }

  let homeTeam: string | null = null, awayTeam: string | null = null
  let homeScore: number | null = null, awayScore: number | null = null
  const matchStats: Record<string, { home: number; away: number }> = {}
  let invalidReason: string | null = null
  // Provenance of the accepted score, so a weak source cannot overrule a strong
  // source's rejection. See the guard just before the return.
  let visionRejected = false
  let scoreFromVision = false
  let scoreFromHeaderMatch = false

  // Stat writes follow a precedence ladder — tesseract (weakest, sets first),
  // text LLM, vision (strongest, overwrites). A low-confidence read on a key
  // never erases a higher-confidence one.
  const setStat = (k: string, v?: { home: number; away: number } | null) => {
    if (v && v.home != null && v.away != null) matchStats[k] = { home: v.home, away: v.away }
  }
  const mergeStats = (map: Record<string, { home: number; away: number }> | null | undefined) => {
    for (const [k, v] of Object.entries(map || {})) setStat(k, v)
  }
  const fillMissingTeams = (home: string | null | undefined, away: string | null | undefined) => {
    homeTeam = homeTeam || home || null
    awayTeam = awayTeam || away || null
  }

  // 1. GEMINI VISION is the PRIMARY reader — it reads the ACTUAL PIXELS, so a
  //    bare "2 - 1" with no team labels or stat table still parses. Everything
  //    below only fills fields it left null, or backs it up when it fails.
  let geminiResult: Awaited<ReturnType<typeof analyzeScreenshot>> | null = null
  try {
    geminiResult = await analyzeScreenshot(buffer, mimeType)
    console.log('[ocr] vision', JSON.stringify({
      valid: geminiResult?.valid, reason: geminiResult?.reason || null,
      score: geminiResult ? [geminiResult.homeScore, geminiResult.awayScore] : null,
      teams: geminiResult ? [geminiResult.homeTeam, geminiResult.awayTeam] : null,
      statKeys: geminiResult?.matchStats ? Object.keys(geminiResult.matchStats) : [],
    }), `(${Date.now() - startedAt}ms)`)
  } catch (e) {
    console.error('[ocr] vision failed:', e, `(${Date.now() - startedAt}ms)`)
  }

  if (geminiResult && geminiResult.valid !== false && geminiResult.homeScore != null && geminiResult.awayScore != null) {
    homeScore = geminiResult.homeScore; awayScore = geminiResult.awayScore
    fillMissingTeams(geminiResult.homeTeam, geminiResult.awayTeam)
    invalidReason = null
    mergeStats(geminiResult.matchStats)
    scoreFromVision = true
  } else if (geminiResult && geminiResult.valid === false) {
    // Vision saw no score (menu / live screen / a crop of the stats table with no
    // scoreboard). The verdict stands unless a stronger reader finds a real one.
    invalidReason = geminiResult.reason || null
    visionRejected = true
  }

  // 2. FALLBACK: text LLM reads the GARBLED tesseract text. Only consulted when
  //    vision did not produce a score (failed / invalid / null) — it must never
  //    veto the pixels vision actually saw.
  if (homeScore === null && ocrResult?.rawText) {
    let cleaned: Awaited<ReturnType<typeof cleanOcrText>> | null = null
    try { cleaned = await cleanOcrText(ocrResult.rawText) }
    catch {
      try { cleaned = await cleanOcrWithGroq(ocrResult.rawText) }
      catch (e) { console.error('[ocr] text LLM failed:', e, `(${Date.now() - startedAt}ms)`) }
    }
    if (cleaned && cleaned.valid !== false) {
      fillMissingTeams(cleaned.homeTeam, cleaned.awayTeam)
      if (cleaned.homeScore != null && cleaned.awayScore != null) {
        homeScore = cleaned.homeScore; awayScore = cleaned.awayScore
        invalidReason = null
      }
      mergeStats(cleaned.matchStats)
    } else if (cleaned && cleaned.valid === false) {
      invalidReason = invalidReason || cleaned.reason || null
    }
  }

  // 3. TESSERACT FALLBACK: fills any teams/stats vision and text left null. Its
  //    raw header scores are the last resort too, but only when the header regex
  //    actually matched (`scoreMatched`) — otherwise its 0s are just defaults.
  //    A legit 0 (1-0 / 0-2) is a real read, never `|| null`'d into silence.
  if (ocrResult) {
    fillMissingTeams(ocrResult.homeTeamOcr || null, ocrResult.awayTeamOcr || null)
    mergeStats(ocrResult.stats)
    if (ocrResult.scoreMatched && homeScore === null) {
      homeScore = ocrResult.homeScore
      awayScore = ocrResult.awayScore
      scoreFromHeaderMatch = true
    }
  }

  console.log('[ocr] tesseract/text score:', [homeScore, awayScore], `(${Date.now() - startedAt}ms)`)

  // If any source found a score, a vision/LLM "invalid" verdict is overruled.
  if (homeScore !== null && awayScore !== null) invalidReason = null

  // ...but not when the ONLY score came from the text LLM reading garbled OCR and
  // vision had already said there is no scoreboard in the picture. A cropped
  // screenshot of the stats table produced exactly that: vision correctly rejected
  // it, the text LLM picked "0-3" out of a stat row, and the blanket overrule above
  // turned a junk read into a submittable result. Tesseract's header regex is a real
  // scoreboard hit, so that still overrules.
  if (visionRejected && !scoreFromVision && !scoreFromHeaderMatch) {
    invalidReason = invalidReason || 'no scoreboard visible in the screenshot'
    homeScore = null
    awayScore = null
  }

  // A stat-row label masquerading as a team name is not a team. Drop it so the
  // caller asks for a proper screenshot instead of confirming against fiction.
  if (isImplausibleTeamName(homeTeam)) homeTeam = null
  if (isImplausibleTeamName(awayTeam)) awayTeam = null

  return { homeTeam, awayTeam, homeScore, awayScore, matchStats: Object.keys(matchStats).length > 0 ? matchStats : null, invalidReason }
}

export const STAT_KEY_TO_DB: Record<string, [string, string]> = {
  possession: ['home_possession', 'away_possession'],
  shots: ['home_shots', 'away_shots'],
  shotsOnTarget: ['home_shots_on_target', 'away_shots_on_target'],
  fouls: ['home_fouls', 'away_fouls'],
  offsides: ['home_offsides', 'away_offsides'],
  cornerKicks: ['home_corners', 'away_corners'],
  freeKicks: ['home_free_kicks', 'away_free_kicks'],
  passes: ['home_passes', 'away_passes'],
  successfulPasses: ['home_successful_passes', 'away_successful_passes'],
  crosses: ['home_crosses', 'away_crosses'],
  interceptions: ['home_interceptions', 'away_interceptions'],
  tackles: ['home_tackles', 'away_tackles'],
  saves: ['home_saves', 'away_saves'],
}

export function matchStatsToDbColumns(matchStats: Record<string, { home: number; away: number }> | null): Record<string, number> | null {
  if (!matchStats) return null
  const cols: Record<string, number> = {}

  // Physics sanity guards: an OCR stat must be possible in real football.
  // A misread stat that violates these is DROPPED (kept null) rather than written,
  // so bad OCR never pollutes averages / standings.
  const shots = matchStats.shots
  const passes = matchStats.passes
  const clamp = (n: number) => Math.max(0, Math.min(999, Math.floor(n)))

  for (const [key, [homeCol, awayCol]] of Object.entries(STAT_KEY_TO_DB)) {
    const s = matchStats[key]
    if (s && s.home !== null && s.away !== null) {
      // shots on target can never exceed total shots
      if (key === 'shotsOnTarget' && shots) {
        if (s.home > shots.home || s.away > shots.away) continue
      }
      // successful passes can never exceed total passes
      if (key === 'successfulPasses' && passes) {
        if (s.home > passes.home || s.away > passes.away) continue
      }
      cols[homeCol] = clamp(s.home)
      cols[awayCol] = clamp(s.away)
    }
  }
  return Object.keys(cols).length > 0 ? cols : null
}

export function dbStatsToSessionFormat(statsRow: Record<string, number | null> | null): Record<string, { home: number; away: number }> | null {
  if (!statsRow) return null
  const out: Record<string, { home: number; away: number }> = {}
  for (const [key, [homeCol, awayCol]] of Object.entries(STAT_KEY_TO_DB)) {
    const home = statsRow[homeCol]
    const away = statsRow[awayCol]
    if (home !== null && home !== undefined && away !== null && away !== undefined) {
      out[key] = { home, away }
    }
  }
  return Object.keys(out).length > 0 ? out : null
}