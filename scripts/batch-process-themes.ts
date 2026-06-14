import sharp from 'sharp'
import { readdir, writeFile, mkdir } from 'fs/promises'
import { join, parse } from 'path'

const srcDir = 'C:\\Users\\mqhel\\Downloads\\THEME PICTURES'
const destDir = join(process.cwd(), 'public', 'themes')

// --- Palette extraction (same logic as extract-palette.ts) ---

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
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
  let centroids = pixels.sort(() => Math.random() - 0.5).slice(0, k).map(c => [...c])
  for (let iter = 0; iter < maxIter; iter++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0])
    const counts = Array(k).fill(0)
    for (const p of pixels) {
      let best = 0, minDist = Infinity
      for (let i = 0; i < k; i++) {
        const dist = (p[0] - centroids[i][0]) ** 2 + (p[1] - centroids[i][1]) ** 2 + (p[2] - centroids[i][2]) ** 2
        if (dist < minDist) { minDist = dist; best = i }
      }
      sums[best][0] += p[0]; sums[best][1] += p[1]; sums[best][2] += p[2]
      counts[best]++
    }
    let changed = false
    centroids = centroids.map((c, i) => {
      if (counts[i] === 0) return c
      const nc = [Math.round(sums[i][0] / counts[i]), Math.round(sums[i][1] / counts[i]), Math.round(sums[i][2] / counts[i])]
      if (nc[0] !== c[0] || nc[1] !== c[1] || nc[2] !== c[2]) changed = true
      return nc
    })
    if (!changed) break
  }
  return centroids
}

async function extractColors(buffer: Buffer) {
  const { data } = await sharp(buffer).resize(80, 80, { fit: 'cover' }).flatten().raw().toBuffer({ resolveWithObject: true })
  const pixels: number[][] = []
  for (let i = 0; i < data.length; i += 3) pixels.push([data[i], data[i + 1], data[i + 2]])

  const centroids = kmeans(pixels, 6)
  const hexes = centroids.map(c => rgbToHex(c[0], c[1], c[2]))
  const withLum = hexes.map(h => ({ hex: h, lum: luminance(parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)), sat: saturation(parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)) }))
  const sortedByLum = [...withLum].sort((a, b) => a.lum - b.lum)

  const roles: Record<string, string> = {}
  roles['--color-bg-base'] = sortedByLum[0]?.hex ?? '#000'
  roles['--color-bg-surface'] = sortedByLum[1]?.hex ?? '#111'

  const candidates = withLum.filter(c => c.lum > 40 && c.lum < 210)
  if (candidates.length > 0) {
    const scored = candidates.map(c => ({ hex: c.hex, score: Math.min(...candidates.filter(x => x.hex !== c.hex).map(x => deltaE(c.hex, x.hex))) * 0.5 + c.sat * 100 * 0.5 }))
    scored.sort((a, b) => b.score - a.score)
    roles['--color-accent'] = scored[0]?.hex ?? '#D6B65D'
    roles['--color-accent-hover'] = scored[1]?.hex ?? '#E3C677'
  } else {
    roles['--color-accent'] = '#D6B65D'
    roles['--color-accent-hover'] = '#E3C677'
  }

  const used = new Set(Object.values(roles))
  const remaining = withLum.filter(c => !used.has(c.hex)).sort((a, b) => a.lum - b.lum)
  const surfaceLum = withLum.find(c => c.hex === roles['--color-bg-surface'])?.lum ?? 0
  roles['--color-bg-elevated'] = remaining.find(c => c.lum > surfaceLum)?.hex ?? '#333'
  roles['--color-text-primary'] = '#F7FAFC'
  roles['--color-text-secondary'] = [...withLum].sort((a, b) => b.lum - a.lum)[0]?.hex ?? '#CBD5E0'
  roles['--color-text-muted'] = [...withLum].sort((a, b) => b.lum - a.lum)[1]?.hex ?? '#718096'
  roles['--color-border'] = sortedByLum[2]?.hex ?? '#444'
  roles['--color-accent-muted'] = '#2E2818'
  return roles
}

function slugify(name: string): string {
  return name
    .replace(/\.(jpg|jpeg|png)$/i, '')
    .replace(/-\d+x\d+/g, '')
    .replace(/[-_]+/g, '-')
    .replace(/(?:-unsplash|-)-?/g, '')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function nameFromSlug(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function main() {
  await mkdir(destDir, { recursive: true })

  const files = (await readdir(srcDir))
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .sort()

  const presets: any[] = []

  for (const file of files) {
    const srcPath = join(srcDir, file)
    const parsed = parse(file)
    const slug = slugify(file)
    const destName = slug + '.jpg'
    const destPath = join(destDir, destName)

    console.log(`Processing ${file} → ${destName}...`)

    try {
      const buffer = await sharp(srcPath)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()

      await writeFile(destPath, buffer)

      const colors = await extractColors(buffer)

      presets.push({
        id: slug,
        name: nameFromSlug(slug),
        description: '',
        bgImage: `/themes/${destName}`,
        colors,
      })
    } catch (err) {
      console.error(`Failed on ${file}:`, err)
    }
  }

  // Generate TypeScript code
  let code = `// Auto-generated by batch-process-themes.ts — do not edit manually
import type { ThemePreset } from './themes'

export const ALL_PRESETS: ThemePreset[] = ${JSON.stringify(presets, null, 2)}
`

  await writeFile(join(process.cwd(), 'lib', 'all-presets.ts'), code)
  console.log(`\nDone! ${presets.length} presets generated → lib/all-presets.ts`)
}

main().catch(console.error)
