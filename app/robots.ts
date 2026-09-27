import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://efa-fxyk.vercel.app'

// Link-preview crawlers (WhatsApp, Facebook, X) are allowed by default, but are
// named explicitly so a future blanket `Disallow: /` is caught in review rather
// than silently stripping every shared link's preview card.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [
          'WhatsApp',
          'facebookexternalhit',
          'facebookcatalog',
          'Twitterbot',
          'Slackbot',
          'Slack-ImgProxy',
          'Discordbot',
          'TelegramBot',
          'Googlebot',
          'Google-InspectionTool',
        ],
        allow: '/',
        disallow: ['/admin/', '/api/', '/profile', '/notifications'],
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/profile', '/notifications'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
