import { ImageResponse } from 'next/og'
import { promises as fs } from 'fs'
import path from 'path'

// Dynamic link-preview card.
//
// Two properties are deliberate:
//
//  1. Fonts are static Poppins TTFs read from the repo, not fetched from
//     fonts.gstatic.com at request time. Satori throws when it has no font, so
//     a Google Fonts outage would strip the image off every preview on the
//     site. It also cannot parse *variable* fonts, so the static cut matters —
//     the repo's `app/fonts/GeistVF.woff` is a variable face and makes Satori
//     throw `Cannot read properties of undefined` at render time.
//  2. Team crests are fetched as bytes and inlined as data URIs. They are never
//     read off disk with `fs`: `public/logos` is 538 MB and Vercel caps a
//     function bundle at 250 MB uncompressed, so touching those paths here would
//     drag the whole directory into this function's trace. `next.config.mjs`
//     adds an explicit `outputFileTracingExcludes` as a second line of defence.

export const runtime = 'nodejs'

const WIDTH = 1200
const HEIGHT = 630
const CREST_BUCKET = '512x512'

const BRAND_BG = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
const GOLD = '#fbbf24'
const MUTED = '#94a3b8'

const FOLDER_RE = /^[a-z0-9][a-z0-9.-]*$/
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/**
 * Fetch a team crest and inline it as a PNG data URI, or null if it is missing.
 * Satori throws on a broken <img>, so crests are optional by design and a bad
 * slug degrades to a text-only card rather than a failed preview.
 */
async function loadCrest(
  origin: string,
  folder: string | null,
  slug: string | null,
): Promise<string | null> {
  if (!folder || !slug) return null
  if (!FOLDER_RE.test(folder) || !SLUG_RE.test(slug)) return null
  try {
    const res = await fetch(`${origin}/logos/${folder}/${CREST_BUCKET}/${slug}.png`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: 'normal' }

let fontCache: OgFont[] | null = null

async function readFont(file: string): Promise<OgFont | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'app', 'fonts', file))
    const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    return { name: 'Poppins', data, weight: 400, style: 'normal' }
  } catch {
    return null
  }
}

async function loadFonts(): Promise<OgFont[] | null> {
  if (fontCache) return fontCache
  const [semibold, bold] = await Promise.all([
    readFont('Poppins-SemiBold.ttf'),
    readFont('Poppins-Bold.ttf'),
  ])
  const fonts = [semibold, bold].filter(Boolean) as OgFont[]
  if (!fonts.length) return null
  fonts[0].weight = 600
  if (fonts[1]) fonts[1].weight = 700
  fontCache = fonts
  return fontCache
}

function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}\u2026`
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const title = clamp(searchParams.get('title') ?? 'EFA', 90)
  const subtitleRaw = searchParams.get('subtitle')
  const subtitle = subtitleRaw ? clamp(subtitleRaw, 140) : null
  const badge = searchParams.get('badge') ? clamp(searchParams.get('badge') as string, 24) : null

  const [homeCrest, awayCrest, fonts] = await Promise.all([
    loadCrest(origin, searchParams.get('hf'), searchParams.get('hs')),
    loadCrest(origin, searchParams.get('af'), searchParams.get('as')),
    loadFonts(),
  ])

  const hasCrestPair = !!homeCrest && !!awayCrest

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BRAND_BG,
          fontFamily: fonts ? 'Poppins' : 'sans-serif',
          padding: 60,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              border: `3px solid ${GOLD}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 800,
              color: GOLD,
            }}
          >
            EFA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ffffff' }}>EFA</div>
            <div style={{ fontSize: 16, color: MUTED }}>Efootball Federal Association</div>
          </div>
          {badge ? (
            <div
              style={{
                marginLeft: 'auto',
                padding: '10px 22px',
                borderRadius: 999,
                background: GOLD,
                color: '#1a1a2e',
                fontSize: 19,
                fontWeight: 800,
              }}
            >
              {badge}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: hasCrestPair ? 'center' : 'flex-start',
            justifyContent: 'center',
            flex: 1,
            gap: 22,
          }}
        >
          {hasCrestPair ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 44,
                width: '100%',
              }}
            >
              <img src={homeCrest as string} width={140} height={140} alt="" />
              <div style={{ fontSize: 28, color: MUTED, fontWeight: 700 }}>VS</div>
              <img src={awayCrest as string} width={140} height={140} alt="" />
            </div>
          ) : null}

          <div
            style={{
              fontSize: hasCrestPair ? 62 : 74,
              fontWeight: 800,
              color: '#ffffff',
              textAlign: hasCrestPair ? 'center' : 'left',
              lineHeight: 1.1,
              maxWidth: 1040,
            }}
          >
            {title}
          </div>

          {subtitle ? (
            <div
              style={{
                fontSize: hasCrestPair ? 25 : 29,
                color: MUTED,
                textAlign: hasCrestPair ? 'center' : 'left',
                maxWidth: 1040,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 60, height: 4, background: GOLD, borderRadius: 2 }} />
          <div style={{ fontSize: 19, color: MUTED }}>Standings · Fixtures · Results · Polls</div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      ...(fonts ? { fonts } : {}),
    },
  )
}
