import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import sharp from 'sharp'

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

function assignRoles(hexes: string[]): Record<string, string> {
  const withLum = hexes.map(h => ({
    hex: h,
    lum: luminance(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)),
    sat: saturation(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)),
  }))

  const sortedByLum = [...withLum].sort((a, b) => a.lum - b.lum)
  const roles: Record<string, string> = {}

  // Darkest → bg-base, second darkest → bg-surface
  roles['--color-bg-base'] = sortedByLum[0]?.hex ?? '#000'
  roles['--color-bg-surface'] = sortedByLum[1]?.hex ?? '#111'

  // Accent = most unique/saturated color that's mid-luminance
  const candidates = withLum.filter(c => c.lum > 40 && c.lum < 210)
  if (candidates.length > 0) {
    const scored = candidates.map(c => ({
      hex: c.hex,
      score: Math.min(...candidates.filter(x => x.hex !== c.hex).map(x => deltaE(c.hex, x.hex))) * 0.5 + c.sat * 100 * 0.5,
    }))
    scored.sort((a, b) => b.score - a.score)
    roles['--color-accent'] = scored[0]?.hex ?? '#D6B65D'
    roles['--color-accent-hover'] = scored[1]?.hex ?? '#E3C677'
  } else {
    roles['--color-accent'] = '#D6B65D'
    roles['--color-accent-hover'] = '#E3C677'
  }

  // Remaining: assign by luminance
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

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  // Validate file
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }
  const MAX_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 })
  }

  // Convert file to buffer
  const buffer = Buffer.from(await file.arrayBuffer())

  // Upload to Supabase Storage
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `${user.id}/theme-${Date.now()}.${ext}`

  const adminSupabase = await createAdminClient()

  // Delete old theme backgrounds for this user
  const { data: existing } = await adminSupabase.storage.from('theme_backgrounds').list(user.id)
  if (existing && existing.length > 0) {
    await adminSupabase.storage.from('theme_backgrounds').remove(existing.map((f) => `${user.id}/${f.name}`))
  }

  const { error: uploadError } = await adminSupabase.storage
    .from('theme_backgrounds')
    .upload(fileName, file, { upsert: true, contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = adminSupabase.storage.from('theme_backgrounds').getPublicUrl(fileName)
  const bgUrl = urlData?.publicUrl ?? ''

  // Extract pixels with sharp for palette extraction
  const { data } = await sharp(buffer)
    .resize(120, 120, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels: number[][] = []
  for (let i = 0; i < data.length; i += 3) {
    pixels.push([data[i], data[i + 1], data[i + 2]])
  }

  // Run k-means for 6 colors
  const centroids = kmeans(pixels, 6)

  // Convert to hex
  const hexes = centroids.map(c => rgbToHex(c[0], c[1], c[2]))

  // Assign roles
  const colors = assignRoles(hexes)

  return NextResponse.json({ colors, bgUrl })
}
