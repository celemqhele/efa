// Client-side screenshot parsing — no Node/Sharp/Tesseract imports.
// Tesseract is called by the caller (browser); this file only does the text→data step.

export interface ClientParsedResult {
  homeTeamOcr: string
  awayTeamOcr: string
  homeScore: number
  awayScore: number
  stats: Record<string, number>
}

// ── Ordered label map — LONGER / MORE SPECIFIC entries first ─────────────────
// Order matters: 'passes' would match inside 'successful passes' if it came first.
const LABEL_MAP: [string, string][] = [
  ['shots on target',   'shots_on_target'],
  ['successful passes', 'successful_passes'],
  ['corner kicks',      'corners'],
  ['free kicks',        'free_kicks'],
  ['possession',        'possession'],
  ['shots',             'shots'],
  ['fouls',             'fouls'],
  ['offsides',          'offsides'],
  ['offside',           'offsides'],
  ['corners',           'corners'],
  ['passes',            'passes'],
  ['crosses',           'crosses'],
  ['interceptions',     'interceptions'],
  ['tackles',           'tackles'],
  ['saves',             'saves'],
]

function parseNum(s: string): number {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

function tryMatchLabel(
  label: string,
  homeStr: string,
  awayStr: string,
  stats: Record<string, number>,
) {
  const norm = label.toLowerCase().trim()
  for (const [key, statKey] of LABEL_MAP) {
    if (norm.includes(key)) {
      stats[`home_${statKey}`] = parseNum(homeStr)
      stats[`away_${statKey}`] = parseNum(awayStr)
      return true
    }
  }
  return false
}

export function parseOcrText(text: string): ClientParsedResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

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
      homeScore   = parseInt(m1[2])
      awayScore   = parseInt(m1[3])
      awayTeamOcr = m1[4].trim()
      break
    }

    const m2 = line.match(efootballHeader)
    if (m2 && !homeTeamOcr) {
      homeTeamOcr = m2[1].trim()
      homeScore   = parseInt(m2[2])
      awayScore   = parseInt(m2[3])
      awayTeamOcr = ''
    }
  }

  // Fallback: look for score near "Full Time"
  if (!homeTeamOcr) {
    const ftIdx = lines.findIndex((l) => /full\s*time/i.test(l))
    if (ftIdx > 0) {
      const digits = lines[ftIdx - 1].match(/(\d+)/g)
      if (digits && digits.length >= 2) {
        homeScore = parseInt(digits[digits.length - 2])
        awayScore = parseInt(digits[digits.length - 1])
        const nm = lines[ftIdx - 1].match(/^([A-Za-z\s]+?)\s+\d/)
        homeTeamOcr = nm ? nm[1].trim() : ''
      }
    }
  }

  const stats: Record<string, number> = {}

  // ── Strategy 1: inline "homeNum label awayNum" (with optional pipe separators)
  // Handles: "46% Possession 54%", "6 | Shots on Target | 9", "143 Passes 138"
  const reLine = /^(\d+%?)\s*[|]?\s*([A-Za-z][A-Za-z\s]{2,}?)\s*[|]?\s*(\d+%?)\s*$/
  for (const line of lines) {
    const m = line.match(reLine)
    if (m) tryMatchLabel(m[2], m[1], m[3], stats)
  }

  // ── Strategy 2: triplet pattern — each value/label on its own line
  // Handles OCR that reads: "143\nPasses\n138\n119\nSuccessful Passes\n107\n..."
  for (let i = 0; i + 2 < lines.length; i++) {
    const numA = lines[i].match(/^(\d+%?)\s*$/)
    const numB = lines[i + 2].match(/^(\d+%?)\s*$/)
    const mid  = lines[i + 1]
    // mid must look like a stat label (starts with letter, no digits)
    if (numA && numB && /^[A-Za-z]/.test(mid) && !/\d/.test(mid)) {
      tryMatchLabel(mid, numA[1], numB[1], stats)
    }
  }

  // ── Strategy 3: "label homeNum awayNum" (label-first layout)
  // Handles: "Possession 46% 54%", "Passes 143 138"
  const reLabel = /^([A-Za-z][A-Za-z\s]{2,}?)\s+(\d+%?)\s+(\d+%?)\s*$/
  for (const line of lines) {
    const m = line.match(reLabel)
    if (m) tryMatchLabel(m[1], m[2], m[3], stats)
  }

  return { homeTeamOcr, awayTeamOcr, homeScore, awayScore, stats }
}

// Crop the image to the eFootball center stats panel using Canvas API.
// Returns a blob URL the caller can pass directly to Tesseract.recognize().
export async function cropToStatsPanel(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight

      // Wider crop to ensure home values (left column) and away values (right column)
      // are both captured. eFootball stats layout spans roughly 20%–80% of screen width.
      const cropLeft   = Math.round(w * 0.18)
      const cropTop    = Math.round(h * 0.08)
      const cropWidth  = Math.round(w * 0.64)
      const cropHeight = Math.round(h * 0.88)

      const canvas = document.createElement('canvas')
      canvas.width  = cropWidth
      canvas.height = cropHeight
      const ctx = canvas.getContext('2d')!

      // Greyscale + contrast boost helps Tesseract accuracy
      ctx.filter = 'grayscale(1) contrast(1.5)'
      ctx.drawImage(img, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
      URL.revokeObjectURL(url)

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'))
        resolve(URL.createObjectURL(blob))
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  })
}
