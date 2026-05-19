import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EFA — Efootball Federal Association',
  description: 'The official EFA league management platform for competitive eFootball.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/efa-icon-192.png',
    apple: '/icons/efa-icon-192.png',
  },
  openGraph: {
    title: 'EFA — Efootball Federal Association',
    description: 'Standings, fixtures, results, and more.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#c9a84c',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-slate-50 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  )
}
