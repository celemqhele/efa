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

  // Preprocess: greyscale + contrast + sharpen
  const processed = await sharp(imageBuffer)
    .greyscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer()

  const { data: { text } } = await Tesseract.recognize(processed, 'eng', {
    logger: () => {},
  })

  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

  // Parse header line: "TeamA X - Y TeamB" or "TeamA X Y TeamB"
  let homeTeamOcr = ''
  let awayTeamOcr = ''
  let homeScore = 0
  let awayScore = 0

  const headerPattern = /^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+)$/
  for (const line of lines) {
    const m = line.match(headerPattern)
    if (m) {
      homeTeamOcr = m[1].trim()
      homeScore = parseInt(m[2])
      awayScore = parseInt(m[3])
      awayTeamOcr = m[4].trim()
      break
    }
  }

  const stats: Partial<ParsedMatchStats> = {}

  // Parse stat table rows: "HomeValue | Label | AwayValue" or "HomeValue Label AwayValue"
  const statPattern = /^(\d+%?)\s*[|]\s*(.+?)\s*[|]\s*(\d+%?)$/
  const statPatternAlt = /^(\d+%?)\s+(.+?)\s+(\d+%?)$/

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
