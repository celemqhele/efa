import type { Metadata, Viewport } from 'next'
import './globals.css'
import ThemeProvider from '@/components/ui/ThemeProvider'
import PushNotificationInit from '@/components/ui/PushNotificationInit'
import GlobalNotifications from '@/components/ui/GlobalNotifications'
import UpdateBanner from '@/components/ui/UpdateBanner'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://efa-fxyk.vercel.app'),
  title: { default: 'EFA — Efootball Federal Association', template: '%s | EFA' },
  description: 'The official EFA league management platform for competitive eFootball.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/efa-icon-192.png',
    apple: '/icons/efa-icon-192.png',
  },
  // Fallback for any route without its own metadata. Keeping explicit
  // og:title/og:description here matters because WhatsApp reads og:* and ignores
  // the <title> element, so an empty object degrades to a bare site name.
  openGraph: {
    title: 'EFA — Efootball Federal Association',
    description: 'The official EFA league management platform for competitive eFootball.',
    siteName: 'EFA',
    type: 'website',
    locale: 'en_GB',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EFA — Efootball Federal Association',
    description: 'The official EFA league management platform for competitive eFootball.',
  },
}

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Must be a literal colour: a CSS var is not a valid value here and is
  // dropped when the theme colour is applied by the OS chrome.
  themeColor: '#0a1128',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased min-h-screen">
        <ThemeProvider>
          {children}
          <PushNotificationInit />
          <GlobalNotifications />
          <UpdateBanner />
        </ThemeProvider>
        <div id="portal-root" />
      </body>
    </html>
  )
}

