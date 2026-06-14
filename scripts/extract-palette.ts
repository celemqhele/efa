import sharp from 'sharp'

const [imagePath, kStr] = process.argv.slice(2)
const k = parseInt(kStr || '6', 10)

if (!imagePath) {
  console.error('Usage: npx tsx scripts/extract-palette.ts <image-path> [num-colors=6]')
  process.exit(1)
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return 0
  const d = max - min
  return l > 128 ? d / (510 - max - min) : d / (max + min)
}

function deltaE(hex1: string, hex2: string): number {
  const toRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const [r1, g1, b1] = toRgb(hex1)
  const [r2, g2, b2] = toRgb(hex2)
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

function kmeans(pixels: number[][], k: number, maxIter = 30) {
  let centroids = pixels
    .sort(() => Math.random() - 0.5)
    .slice(0, k)
    .map(c => [...c])

  for (let iter = 0; iter < maxIter; iter++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0])
    const counts = Array(k).fill(0)

    for (const p of pixels) {
      let best = 0
      let minDist = Infinity
      for (let i = 0; i < k; i++) {
        const dist = (p[0] - centroids[i][0]) ** 2 + (p[1] - centroids[i][1]) ** 2 + (p[2] - centroids[i][2]) ** 2
        if (dist < minDist) { minDist = dist; best = i }
      }
      sums[best][0] += p[0]
      sums[best][1] += p[1]
      sums[best][2] += p[2]
      counts[best]++
    }

    let changed = false
    centroids = centroids.map((c, i) => {
      if (counts[i] === 0) return c
      const newC = [Math.round(sums[i][0] / counts[i]), Math.round(sums[i][1] / counts[i]), Math.round(sums[i][2] / counts[i])]
      if (newC[0] !== c[0] || newC[1] !== c[1] || newC[2] !== c[2]) changed = true
      return newC
    })
    if (!changed) break
  }
  return centroids
}

function suggestRole(hex: string, allHexes: string[], sortedByCoverage: { hex: string; lum: number; sat: number }[]): string {
  const [r, g, b] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  const lum = luminance(r, g, b)
  const sat = saturation(r, g, b)

  // Sort by luminance — darkest → bg-base, second darkest → bg-surface
  const sortedByLum = [...sortedByCoverage].sort((a, b) => a.lum - b.lum)
  const darkestHex = sortedByLum[0]?.hex
  const secondDarkest = sortedByLum[1]?.hex
  const brightest = sortedByLum[sortedByLum.length - 1]?.hex
  const secondBrightest = sortedByLum[sortedByLum.length - 2]?.hex

  if (hex === darkestHex) return 'bg-base'
  if (hex === secondDarkest) return 'bg-surface'

  // Accent = most unique/saturated color that isn't too dark or too light
  const accentCandidates = allHexes.filter(h => {
    const hl = sortedByCoverage.find(x => x.hex === h)?.lum ?? 128
    return hl > 40 && hl < 230
  })
  if (accentCandidates.length > 0) {
    const scored = accentCandidates.map(h => ({
      hex: h,
      score: Math.min(...accentCandidates.filter(x => x !== h).map(x => deltaE(h, x))) * 0.5 +
             saturation(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)) * 100 * 0.5
    }))
    const bestAccent = scored.sort((a, b) => b.score - a.score)[0]?.hex
    if (hex === bestAccent) return 'accent'
    const secondAccent = scored.sort((a, b) => b.score - a.score)[1]?.hex
    if (hex === secondAccent) return 'accent-hover'
  }

  if (hex === brightest && sat < 0.18) return 'text-primary'
  if (hex === secondBrightest && sat < 0.18) return 'text-secondary'
  return 'bg-elevated'
}

function analyzePalette(sorted: { hex: string; coverage: string; rgb: string }[]) {
  const analyzed = sorted.map(s => ({
    hex: s.hex,
    lum: luminance(parseInt(s.hex.slice(1, 3), 16), parseInt(s.hex.slice(3, 5), 16), parseInt(s.hex.slice(5, 7), 16)),
    sat: saturation(parseInt(s.hex.slice(1, 3), 16), parseInt(s.hex.slice(3, 5), 16), parseInt(s.hex.slice(5, 7), 16)),
  }))

  return sorted.map((s, i) => ({
    ...s,
    suggestedRole: suggestRole(s.hex, sorted.map(x => x.hex), analyzed),
  }))
}

async function main() {
  const { data, info } = await sharp(imagePath)
    .resize(120, 120, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels: number[][] = []
  for (let i = 0; i < data.length; i += 3) {
    pixels.push([data[i], data[i + 1], data[i + 2]])
  }

  const centroids = kmeans(pixels, k)

  const counts = Array(k).fill(0)
  for (const p of pixels) {
    let best = 0
    let minDist = Infinity
    for (let i = 0; i < k; i++) {
      const dist = (p[0] - centroids[i][0]) ** 2 + (p[1] - centroids[i][1]) ** 2 + (p[2] - centroids[i][2]) ** 2
      if (dist < minDist) { minDist = dist; best = i }
    }
    counts[best]++
  }

  const sorted = centroids
    .map((c, i) => ({
      hex: rgbToHex(c[0], c[1], c[2]),
      rgb: `rgb(${c[0]}, ${c[1]}, ${c[2]})`,
      coverage: ((counts[i] / pixels.length) * 100).toFixed(1) + '%',
    }))
    .sort((a, b) => parseFloat(b.coverage) - parseFloat(a.coverage))

  const withRoles = analyzePalette(sorted)

  // Draw color swatches in terminal
  console.log(`\n  Palette from: ${imagePath}\n`)
  for (const c of withRoles) {
    const block = `\x1b[48;2;${parseInt(c.hex.slice(1, 3), 16)};${parseInt(c.hex.slice(3, 5), 16)};${parseInt(c.hex.slice(5, 7), 16)}m  \x1b[0m`
    console.log(`  ${block}  ${c.hex}  ${c.rgb.padEnd(18)} ${c.coverage.padStart(6)}  → ${c.suggestedRole}`)
  }

  // Suggested theme mapping
  console.log(`\n  ─── Suggested CSS Variable Mapping ───\n`)
  const roleMap: Record<string, string> = {}
  for (const c of withRoles) {
    const role = c.suggestedRole
    if (!roleMap[role]) roleMap[role] = c.hex
  }

  if (roleMap['bg-base']) console.log(`    --color-bg-base:        ${roleMap['bg-base']}`)
  if (roleMap['bg-surface']) console.log(`    --color-bg-surface:     ${roleMap['bg-surface']}`)
  if (roleMap['bg-elevated']) console.log(`    --color-bg-elevated:    ${roleMap['bg-elevated']}`)
  if (roleMap['accent']) console.log(`    --color-accent:         ${roleMap['accent']}`)
  if (roleMap['text-primary']) console.log(`    --color-text-primary:   ${roleMap['text-primary']}`)
  console.log()

  // JSON output for programmatic use
  const json = {
    source: imagePath,
    palette: withRoles.map(c => ({ hex: c.hex, coverage: c.coverage, role: c.suggestedRole })),
    theme: {
      '--color-bg-base': roleMap['bg-base'] || null,
      '--color-bg-surface': roleMap['bg-surface'] || null,
      '--color-bg-elevated': roleMap['bg-elevated'] || null,
      '--color-accent': roleMap['accent'] || null,
      '--color-text-primary': roleMap['text-primary'] || null,
    },
  }

  // Save JSON next to the image
  const outPath = imagePath.replace(/\.(jpg|jpeg|png|webp)$/i, '-palette.json')
  if (outPath !== imagePath) {
    const fs = await import('fs/promises')
    await fs.writeFile(outPath, JSON.stringify(json, null, 2))
    console.log(`  Saved: ${outPath}\n`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
