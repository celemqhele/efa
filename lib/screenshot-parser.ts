'use server'

// Only imported on server — Tesseract and Sharp are Node-only
import type { MatchStats } from '@/lib/supabase/types'

export interface ParsedMatchStats extends Omit<MatchStats, 'id' | 'result_id'> {}

export interface ParsedResult {
  homeTeamOcr: string
  awayTeamOcr: string
  homeScore: number
  awayScore: number
  stats: Partial<ParsedMatchStats>
}

const STAT_LABEL_MAP: Record<string, keyof ParsedMatchStats> = {
  'possession': 'home_possession',
  'shots on target': 'home_shots_on_target',
  'shots': 'home_shots',
  'fouls': 'home_fouls',
  'offsides': 'home_offsides',
  'corner kicks': 'home_corners',
  'corners': 'home_corners',
  'free kicks': 'home_free_kicks',
  'passes': 'home_passes',
  'successful passes': 'home_successful_passes',
  'crosses': 'home_crosses',
  'interceptions': 'home_interceptions',
  'tackles': 'home_tackles',
  'saves': 'home_saves',
}

function parseNumber(str: string): number {
  const n = parseInt(str.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

function parsePossession(str: string): number {
  const match = str.match(/(\d+)%?/)
  return match ? parseInt(match[1]) : 0
}

export async function parseScreenshot(imageBuffer: Buffer): Promise<ParsedResult> {
  // Dynamic imports to avoid Next.js bundling issues with Node modules
  const sharp = (await import('sharp')).default
  const Tesseract = await import('tesseract.js')

  // Get image dimensions so we can crop to the eFootball stats panel.
  // The center stats table always occupies ~32–68% of width and ~10–95% of height.
  // Cropping strips the yellow side panels, team badges, and player photos — all noise
  // for OCR — and reduces the image area to ~15% of the original, which is much faster.
  const meta = await sharp(imageBuffer).metadata()
  const w = meta.width ?? 1920
  const h = meta.height ?? 1080

  const cropLeft   = Math.round(w * 0.32)
  const cropWidth  = Math.round(w * 0.36)
  const cropTop    = Math.round(h * 0.10)
  const cropHeight = Math.round(h * 0.85)

  const processed = await sharp(imageBuffer)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .greyscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer()

  const { data: { text } } = await Tesseract.recognize(processed, 'eng', {
    logger: () => {},
  })

  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

  let homeTeamOcr = ''
  let awayTeamOcr = ''
  let homeScore = 0
  let awayScore = 0

  // Strategy 1: standard "Team A X - Y Team B" format
  const standardHeader = /^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+)$/
  // Strategy 2: eFootball style — "TEAM_NAME SCORE [≡/logo/noise] SCORE TEAM_NAME"
  // The separator between scores is a non-alphanumeric character (≡ logo, dash, etc.)
  const efootballHeader = /^(.+?)\s+(\d{1,2})\s+[^0-9a-zA-Z\s][^\d]*(\d{1,2})/

  for (const line of lines) {
    // Skip the "Full Time" line itself
    if (/full\s*time/i.test(line)) continue

    const m1 = line.match(standardHeader)
    if (m1) {
      homeTeamOcr = m1[1].trim()
      homeScore = parseInt(m1[2])
      awayScore = parseInt(m1[3])
      awayTeamOcr = m1[4].trim()
      break
    }

    const m2 = line.match(efootballHeader)
    if (m2 && !homeTeamOcr) {
      homeTeamOcr = m2[1].trim()
      homeScore = parseInt(m2[2])
      awayScore = parseInt(m2[3])
      // Away team name not reliably parseable in eFootball format — leave blank for manual matching
      awayTeamOcr = ''
    }
  }

  // If still no scores found, try extracting the two numbers closest to "Full Time" header
  if (!homeTeamOcr) {
    const fullTimeIdx = lines.findIndex((l) => /full\s*time/i.test(l))
    if (fullTimeIdx > 0) {
      const headerLine = lines[fullTimeIdx - 1]
      const digits = headerLine.match(/(\d+)/g)
      if (digits && digits.length >= 2) {
        homeScore = parseInt(digits[digits.length - 2])
        awayScore = parseInt(digits[digits.length - 1])
        // Extract team name as everything before the first digit group
        const nameMatch = headerLine.match(/^([A-Za-z\s]+?)\s+\d/)
        homeTeamOcr = nameMatch ? nameMatch[1].trim() : ''
      }
    }
  }

  const stats: Partial<ParsedMatchStats> = {}

  // Parse stat table rows — handles both pipe-delimited and space-delimited formats:
  // "51% | Possession | 49%"  or  "51% Possession 49%"  or  "19 Shots 3"
  const statPattern = /^(\d+%?)\s*[|]\s*(.+?)\s*[|]\s*(\d+%?)/
  const statPatternAlt = /^(\d+%?)\s+([A-Za-z][A-Za-z\s]{2,}?)\s+(\d+%?)\s*$/

  for (const line of lines) {
    const m = line.match(statPattern) || line.match(statPatternAlt)
    if (!m) continue

    const homeVal = m[1]
    const label = m[2].toLowerCase().trim()
    const awayVal = m[3]

    for (const [key, homeField] of Object.entries(STAT_LABEL_MAP)) {
      if (label.includes(key)) {
        const awayField = homeField.replace('home_', 'away_') as keyof ParsedMatchStats

        if (label.includes('possession')) {
          ;(stats as Record<string, number>)[homeField] = parsePossession(homeVal)
          ;(stats as Record<string, number>)[awayField] = parsePossession(awayVal)
        } else {
          ;(stats as Record<string, number>)[homeField] = parseNumber(homeVal)
          ;(stats as Record<string, number>)[awayField] = parseNumber(awayVal)
        }
        break
      }
    }
  }

  return { homeTeamOcr, awayTeamOcr, homeScore, awayScore, stats }
}
