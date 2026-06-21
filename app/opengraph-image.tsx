import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  const fontData = await fetch(
    'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
  ).then((r) => r.arrayBuffer())

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
          fontFamily: 'Inter',
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
      fonts: [{ name: 'Inter', data: fontData, weight: 400 }],
    },
  )
}
