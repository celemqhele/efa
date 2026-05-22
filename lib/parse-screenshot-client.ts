// Client-side screenshot parsing — no Node/Sharp/Tesseract imports.
// Tesseract is called by the caller (browser); this file only does the text→data step.

export interface ClientParsedResult {
  homeTeamOcr: string
  awayTeamOcr: string
  homeScore: number
  awayScore: number
  stats: Record<string, number>
}

const STAT_LABEL_MAP: Record<string, string> = {
  'possession':        'possession',
  'shots on target':   'shots_on_target',
  'shots':             'shots',
  'fouls':             'fouls',
  'offsides':          'offsides',
  'corner kicks':      'corners',
  'corners':           'corners',
  'free kicks':        'free_kicks',
  'passes':            'passes',
  'successful passes': 'successful_passes',
  'crosses':           'crosses',
  'interceptions':     'interceptions',
  'tackles':           'tackles',
  'saves':             'saves',
}

function parseNum(s: string): number {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

export function parseOcrText(text: string): ClientParsedResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  let homeTeamOcr = ''
  let awayTeamOcr = ''
  let homeScore = 0
  let awayScore = 0

  const standardHeader = /^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+)$/
  // eFootball: "TEAM_NAME SCORE [≡ or any non-alphanum] SCORE [rest]"
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

  // Parse stat rows: "46% Possession 54%" or "6 Shots 9"
  const statPipe = /^(\d+%?)\s*[|]\s*(.+?)\s*[|]\s*(\d+%?)/
  const statAlt  = /^(\d+%?)\s+([A-Za-z][A-Za-z\s]{2,}?)\s+(\d+%?)\s*$/

  const stats: Record<string, number> = {}

  for (const line of lines) {
    const m = line.match(statPipe) || line.match(statAlt)
    if (!m) continue

    const homeVal = m[1]
    const label   = m[2].toLowerCase().trim()
    const awayVal = m[3]

    for (const [key, statKey] of Object.entries(STAT_LABEL_MAP)) {
      if (label.includes(key)) {
        stats[`home_${statKey}`] = parseNum(homeVal)
        stats[`away_${statKey}`] = parseNum(awayVal)
        break
      }
    }
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

      const cropLeft   = Math.round(w * 0.32)
      const cropTop    = Math.round(h * 0.10)
      const cropWidth  = Math.round(w * 0.36)
      const cropHeight = Math.round(h * 0.85)

      const canvas = document.createElement('canvas')
      canvas.width  = cropWidth
      canvas.height = cropHeight
      const ctx = canvas.getContext('2d')!

      // Greyscale + contrast boost via CSS filter on the canvas context
      ctx.filter = 'grayscale(1) contrast(1.4)'
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
