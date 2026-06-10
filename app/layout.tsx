import type { Metadata, Viewport } from 'next'
import './globals.css'
import ThemeProvider from '@/components/ui/ThemeProvider'
import PushNotificationInit from '@/components/ui/PushNotificationInit'
import GlobalNotifications from '@/components/ui/GlobalNotifications'

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
        </ThemeProvider>
      </body>
    </html>
  )
}

