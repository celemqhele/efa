import type { Metadata, Viewport } from 'next'
import './globals.css'
import ThemeProvider from '@/components/ui/ThemeProvider'
import PushNotificationInit from '@/components/ui/PushNotificationInit'
import GlobalNotifications from '@/components/ui/GlobalNotifications'
import UpdateBanner from '@/components/ui/UpdateBanner'

export const metadata: Metadata = {
  title: { default: 'EFA — Efootball Federal Association', template: '%s | EFA' },
  description: 'The official EFA league management platform for competitive eFootball.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/efa-icon-192.png',
    apple: '/icons/efa-icon-192.png',
  },
  openGraph: {
    siteName: 'EFA',
    type: 'website',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: 'var(--color-accent)',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
      </head>
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

