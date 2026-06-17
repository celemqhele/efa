import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" stroke="#fbbf24" strokeWidth="4" fill="none" />
            <text x="50" y="62" textAnchor="middle" fill="#fbbf24" fontSize="48" fontWeight="bold" fontFamily="serif">EFA</text>
          </svg>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#ffffff', letterSpacing: -1 }}>Efootball Federal Association</div>
          <div style={{ fontSize: 22, color: '#94a3b8', marginTop: 8 }}>Competitive eFootball league management platform</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
