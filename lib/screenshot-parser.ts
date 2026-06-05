'use server'

// Only imported on server — Tesseract and Sharp are Node-only

export interface ParsedResult {
  homeTeamOcr: string
  awayTeamOcr: string
  homeScore: number
  awayScore: number
  stats: Record<string, { home: number; away: number }>
}

// Ordered list of stats to match, from longest/most specific to shortest.
// This prevents "Passes" matching "Successful Passes" prematurely.
const STAT_MATCHERS = [
  { label: 'successful passes', key: 'successfulPasses' },
  { label: 'shots on target', key: 'shotsOnTarget' },
  { label: 'possession', key: 'possession' },
  { label: 'shots', key: 'shots' },
  { label: 'fould', key: 'fouls' }, // Handle OCR common error or user's specific note
  { label: 'fouls', key: 'fouls' },
  { label: 'offsides', key: 'offsides' },
  { label: 'offside', key: 'offsides' },
  { label: 'corner kicks', key: 'cornerKicks' },
  { label: 'corners', key: 'cornerKicks' },
  { label: 'free kicks', key: 'freeKicks' },
  { label: 'passes', key: 'passes' },
  { label: 'crosses', key: 'crosses' },
  { label: 'interceptions', key: 'interceptions' },
  { label: 'tackles', key: 'tackles' },
  { label: 'saves', key: 'saves' },
]

function parseNumber(str: string): number {
  const n = parseInt(str.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

function parsePossession(str: string): number {
  const match = str.match(/(\d+)%?/)
  return match ? parseInt(match[1]) : 0
}

export async function parseScreenshot(imageBuffer: Buffer): Promise<ParsedResult> {
  const sharp = (await import('sharp')).default
  const Tesseract = await import('tesseract.js')

  const meta = await sharp(imageBuffer).metadata()
  const w = meta.width ?? 1920
  const h = meta.height ?? 1080

  // The center stats table in eFootball matches
  const cropLeft   = Math.round(w * 0.30)
  const cropWidth  = Math.round(w * 0.40)
  const cropTop    = Math.round(h * 0.08)
  const cropHeight = Math.round(h * 0.90)

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

  const standardHeader = /^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+)$/
  const efootballHeader = /^(.+?)\s+(\d{1,2})\s+[^0-9a-zA-Z\s][^\d]*(\d{1,2})/

  for (const line of lines) {
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
      awayTeamOcr = ''
    }
  }

  if (!homeTeamOcr) {
    const fullTimeIdx = lines.findIndex((l) => /full\s*time/i.test(l))
    if (fullTimeIdx > 0) {
      const headerLine = lines[fullTimeIdx - 1]
      const digits = headerLine.match(/(\d+)/g)
      if (digits && digits.length >= 2) {
        homeScore = parseInt(digits[digits.length - 2])
        awayScore = parseInt(digits[digits.length - 1])
        const nameMatch = headerLine.match(/^([A-Za-z\s]+?)\s+\d/)
        homeTeamOcr = nameMatch ? nameMatch[1].trim() : ''
      }
    }
  }

  const stats: Record<string, { home: number; away: number }> = {}

  // More flexible pattern to capture numbers around a label, potentially with noise
  const statRegex = /^(\d+%?)\s+([^0-9]+)\s+(\d+%?)$/

  for (const line of lines) {
    const m = line.match(statRegex)
    if (!m) continue

    const homeValStr = m[1]
    const label = m[2].toLowerCase().trim()
    const awayValStr = m[3]

    for (const matcher of STAT_MATCHERS) {
      if (label.includes(matcher.label)) {
        const homeVal = matcher.key === 'possession' ? parsePossession(homeValStr) : parseNumber(homeValStr)
        const awayVal = matcher.key === 'possession' ? parsePossession(awayValStr) : parseNumber(awayValStr)
        
        // Only set if not already set (respect priority of STAT_MATCHERS order)
        if (!stats[matcher.key]) {
          stats[matcher.key] = { home: homeVal, away: awayVal }
        }
        break
      }
    }
  }

  return { homeTeamOcr, awayTeamOcr, homeScore, awayScore, stats }
}
