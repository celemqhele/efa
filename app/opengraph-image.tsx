import { ImageResponse } from 'next/og'
import { promises as fs } from 'fs'
import path from 'path'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' }

let fontCache: OgFont[] | null = null

/**
 * Static Poppins TTFs from the repo. Satori throws when it has no font, so a
 * fonts.gstatic.com failure would strip the image off every link preview for
 * the whole site rather than just degrade the type. It also cannot parse
 * variable fonts, which is why the static cut is used instead of the
 * `GeistVF.woff` sitting in the same directory.
 */
async function loadFonts(): Promise<OgFont[] | null> {
  if (fontCache) return fontCache
  const read = async (file: string, weight: 400 | 600): Promise<OgFont | null> => {
    try {
      const buf = await fs.readFile(path.join(process.cwd(), 'app', 'fonts', file))
      const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
      return { name: 'Poppins', data, weight, style: 'normal' }
    } catch {
      return null
    }
  }
  const [semibold] = await Promise.all([read('Poppins-SemiBold.ttf', 600), read('Poppins-Bold.ttf', 400)])
  const fonts = [semibold].filter(Boolean) as OgFont[]
  if (!fonts.length) return null
  fontCache = fonts
  return fontCache
}

export default async function OGImage() {
  const fonts = await loadFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          fontFamily: fonts ? 'Poppins' : 'sans-serif',
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            border: '4px solid #fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
            fontSize: 48,
            fontWeight: 900,
            color: '#fbbf24',
          }}
        >
          EFA
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#ffffff', letterSpacing: -1 }}>
          Efootball Federal Association
        </div>
        <div style={{ fontSize: 22, color: '#94a3b8', marginTop: 16 }}>
          Competitive eFootball league management platform
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(fonts ? { fonts } : {}),
    },
  )
}
