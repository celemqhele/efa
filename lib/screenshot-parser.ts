'use server'

// Only imported on server — Tesseract and Sharp are Node-only

export interface ParsedResult {
  homeTeamOcr: string
  awayTeamOcr: string
  homeScore: number
  awayScore: number
  stats: Record<string, { home: number; away: number }>
  rawText: string
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

  // The centre stats table in eFootball matches. Crop slightly wider than the
  // narrow column so digits on the edges (e.g. 3-digit pass counts) aren't cut.
  const cropLeft   = Math.round(w * 0.22)
  const cropWidth  = Math.round(w * 0.56)
  const cropTop    = Math.round(h * 0.08)
  const cropHeight = Math.round(h * 0.90)

  // Upscale 2x before OCR: tesseract misreads 3-digit numbers (250 → 25) on
  // small phone-screenshot crops; doubling the pixel size massively improves
  // digit recognition. Combined with PSM 6 (block of text) which suits the
  // tabular stat layout better than the default auto mode.
  const processed = await sharp(imageBuffer)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .resize({ width: Math.round(cropWidth * 2), withoutEnlargement: false })
    .greyscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer()

  const { data: { text } } = await Tesseract.recognize(processed, 'eng', {
    logger: () => {},
    // Block-of-text segmentation suits the compact stats table; auto mode
    // sometimes splits adjacent numbers and drops trailing digits.
    tessedit_pageseg_mode: '6',
  } as any)

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

  // Multiple patterns to handle different eFootball stat layouts
  const statPatterns: RegExp[] = [
    /^(\d+%?)\s+([^0-9]+)\s+(\d+%?)$/,           // "53% Possession 47%"
    /^(\d+%?)\s+([^0-9]+?)\s+(\d+%?)$/,           // tighter spacing
    /^(\d+)\s{2,}([^0-9]+?)\s{2,}(\d+)$/,         // "53  Possession  47" (tab/multi-space)
    /^([^0-9]+?)\s+(\d+%?)\s+(\d+%?)$/,           // "Possession 53% 47%" (label first)
    /^([^0-9]+?)\s+(\d+)\s+(\d+)$/,               // "Possession 53 47" (label first, no %)
    /^(\d+%?)\s+[|\-–]\s+([^0-9]+?)\s+[|\-–]\s+(\d+%?)$/,  // "53% - Possession - 47%"
  ]

  for (const line of lines) {
    if (stats && Object.keys(stats).length >= 13) break // all stat types found

    for (const statRegex of statPatterns) {
      const m = line.match(statRegex)
      if (!m) continue

      let homeValStr: string
      let label: string
      let awayValStr: string

      // Detect which pattern matched (label-first vs number-first)
      const firstIsNumber = /^\d/.test(m[1])
      if (firstIsNumber) {
        homeValStr = m[1]
        label = m[2].toLowerCase().trim()
        awayValStr = m[3]
      } else {
        label = m[1].toLowerCase().trim()
        homeValStr = m[2]
        awayValStr = m[3]
      }

      for (const matcher of STAT_MATCHERS) {
        if (label.includes(matcher.label)) {
          const homeVal = matcher.key === 'possession' ? parsePossession(homeValStr) : parseNumber(homeValStr)
          const awayVal = matcher.key === 'possession' ? parsePossession(awayValStr) : parseNumber(awayValStr)

          // A stat is kept when both numbers were actually read (a legit 0 is kept — the
          // "home/away both present" check below is what surfaces in eFootball),
          // but a missing/blank side must NOT be recorded to avoid zero-filling.
          if (!stats[matcher.key] && homeVal >= 0 && awayVal >= 0) {
            stats[matcher.key] = { home: homeVal, away: awayVal }
          }
          break
        }
      }
      break // only match one pattern per line
    }
  }

  return { homeTeamOcr, awayTeamOcr, homeScore, awayScore, stats, rawText: text }
}
