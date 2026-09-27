// Shared Open Graph / Twitter card metadata for link previews.
//
// WhatsApp (and every other chat app) reads og:title / og:description / og:image
// and ignores everything else, so a route with no `metadata` export falls back to
// the root layout's generic title and every shared link looks identical. These
// helpers keep each route's block to a few lines and guarantee og: and twitter:
// stay in sync, which is what WhatsApp and X each need respectively.

import type { Metadata } from 'next'
import { getSastDateKey } from '@/lib/app-time'

/**
 * Absolute site origin. `metadataBase` in the root layout is the source of
 * truth; this mirrors it because the dynamic image route is built from a
 * request-relative URL and metadata objects are constructed outside the
 * request scope in some routes.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://efa-fxyk.vercel.app'

/** A team crest for the preview card, resolved by the image route. */
export interface OgLogo {
  /** `logo_league_folder` from the teams table, e.g. `english-premier-league-2025-2026.football-logos.cc` */
  folder: string
  /** `logo_team_slug` from the teams table, e.g. `arsenal` */
  slug: string
}

export interface OgImageParams {
  title: string
  subtitle?: string
  /** Small pill above the title, e.g. "FINAL" or "OPEN". */
  badge?: string
  /** Left-hand crest. */
  home?: OgLogo
  /** Right-hand crest. */
  away?: OgLogo
}

/**
 * Build the `/api/og` query string for a preview card.
 *
 * Returns a root-relative path so it composes with `metadataBase` in
 * `generateMetadata`. Short params (`h`/`a`) keep the URL well under the
 * practical length crawlers tolerate in a query string.
 */
export function ogImagePath(params: OgImageParams): string {
  const sp = new URLSearchParams()
  sp.set('title', params.title)
  if (params.subtitle) sp.set('subtitle', params.subtitle)
  if (params.badge) sp.set('badge', params.badge)
  if (params.home) {
    sp.set('hf', params.home.folder)
    sp.set('hs', params.home.slug)
  }
  if (params.away) {
    sp.set('af', params.away.folder)
    sp.set('as', params.away.slug)
  }
  return `/api/og?${sp.toString()}`
}

export interface OgMetaInput extends OgImageParams {
  /** Page title, e.g. `Standings`. The root layout's `%s | EFA` template applies. */
  title: string
  /** Meta description, reused verbatim as og:description. */
  description: string
  /** Route path, e.g. `/standings`. Used to build the canonical + og:url. */
  path: string
  /** Set false for routes with no meaningful preview (auth, profile). */
  withImage?: boolean
}

/**
 * A `Metadata` fragment with og: and twitter: fully populated.
 *
 * Spread into a route's `metadata` / `generateMetadata` return. `title` is
 * emitted as a bare string so the root layout's template produces "X | EFA".
 */
export function ogMeta(input: OgMetaInput): Metadata {
  const image = input.withImage === false ? undefined : ogImagePath(input)

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: `${input.title} | EFA`,
      description: input.description,
      url: input.path,
      type: 'website',
      siteName: 'EFA',
      locale: 'en_GB',
      ...(image ? { images: [{ url: image, width: 1200, height: 630, type: 'image/png' }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${input.title} | EFA`,
      description: input.description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

/**
 * Format a fixture `scheduled_date` for display.
 *
 * `scheduled_date` is a plain DATE column holding the matchday a manager sees.
 * The `pg` driver parses it as SAST midnight and hands back a `Date` two hours
 * behind UTC, so a 2026-09-25 matchday arrives as `2026-09-24T22:00:00Z`.
 * Running it through `getSastDateKey` recovers the true matchday; a naive
 * `toISOString().slice(0, 10)` would render it a day early.
 */
export function formatMatchday(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const key = typeof value === 'string' ? value.slice(0, 10) : getSastDateKey(value)
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return null
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`
}

/** Human label for a knockout/group `round_type`, e.g. `qf` -> `Quarter-final`. */
export function roundLabel(roundType: string | null | undefined, leg?: number | null): string | null {
  if (!roundType) return null
  const map: Record<string, string> = {
    group: 'Group stage',
    r16: 'Round of 16',
    r32: 'Round of 32',
    qf: 'Quarter-final',
    sf: 'Semi-final',
    final: 'Final',
    third: 'Third-place play-off',
  }
  const base = map[roundType.toLowerCase()] ?? roundType
  return leg && leg > 1 ? `${base} — Leg ${leg}` : base
}
