import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/server'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://efa-fxyk.vercel.app'

// Everything is `force-dynamic` in this app, so an uncached sitemap would run a
// query on every crawler hit. ISR gives an hourly refresh without that cost.
// Fixture and result pages are deliberately excluded: there are thousands and
// they churn constantly, so a static listing would be stale and mostly dead.
export const revalidate = 3600

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/standings', priority: 0.9, changeFrequency: 'daily' },
  { path: '/fixtures', priority: 0.9, changeFrequency: 'hourly' },
  { path: '/results', priority: 0.9, changeFrequency: 'hourly' },
  { path: '/polls', priority: 0.8, changeFrequency: 'daily' },
  { path: '/calendar', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/hall-of-fame', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/premiership', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/rules', priority: 0.5, changeFrequency: 'monthly' },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  try {
    const supabase = await createAdminClient()
    const { data: teams } = await supabase
      .from('teams')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    for (const team of teams ?? []) {
      entries.push({
        url: `${SITE_URL}/teams/${team.id}`,
        lastModified: team.created_at ? new Date(team.created_at) : now,
        changeFrequency: 'weekly',
        priority: 0.5,
      })
    }
  } catch {
    // A sitemap that omits team pages is still useful; failing the whole route
    // would return a 500 to crawlers and lose the static entries too.
  }

  return entries
}
