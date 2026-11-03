// Background stats OCR for the submit-match portal's proof screenshots.
//
// This is deliberately NOT a verification step. The result is already saved by
// the time this runs, so a slow / failed / unreadable OCR read can never delay
// or decline a manager's submission. It only fills the fixture's `match_stats`
// row for the public fixture page.
//
// A screenshot is used only when the scoreline it read agrees with the score the
// manager typed (straight or reversed, because a screenshot taken from the
// opponent's side shows the sides swapped). A different game is ignored, so an
// old screenshot cannot attach the wrong stats to this fixture.

import { analyzeImageBuffer, matchStatsToDbColumns, STAT_KEY_TO_DB } from '@/lib/ocr'

export type PortalShot = {
  buffer: Buffer
  mimeType: string
}

type Orientation = 'straight' | 'reversed' | null

function orientationOf(
  readHome: number | null,
  readAway: number | null,
  typedHome: number,
  typedAway: number,
): Orientation {
  if (readHome === null || readAway === null) return null
  if (readHome === typedHome && readAway === typedAway) return 'straight'
  if (readHome === typedAway && readAway === typedHome) return 'reversed'
  return null
}

/**
 * Read every attached screenshot and merge their stat tables into one set of
 * `match_stats` columns. Returns null when no screenshot matches the typed
 * score or none of them produced usable stats.
 */
export async function readPortalStats(
  shots: PortalShot[],
  typedHome: number,
  typedAway: number,
): Promise<Record<string, number> | null> {
  const merged: Record<string, { home: number; away: number }> = {}
  const allKeys = Object.keys(STAT_KEY_TO_DB).length

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]
    try {
      const analysis = await analyzeImageBuffer(shot.buffer, shot.mimeType)
      const orientation = orientationOf(analysis.homeScore, analysis.awayScore, typedHome, typedAway)
      if (!orientation) {
        console.log('[portal-stats] screenshot ignored: score did not match', {
          index: i + 1,
          read: [analysis.homeScore, analysis.awayScore],
          typed: [typedHome, typedAway],
        })
        continue
      }

      for (const [key, value] of Object.entries(analysis.matchStats ?? {})) {
        if (merged[key]) continue
        merged[key] =
          orientation === 'reversed'
            ? { home: value.away, away: value.home }
            : { home: value.home, away: value.away }
      }
      if (Object.keys(merged).length >= allKeys) break
    } catch (e) {
      console.error(`[portal-stats] screenshot ${i + 1} OCR failed:`, e)
    }
  }

  return matchStatsToDbColumns(Object.keys(merged).length > 0 ? merged : null)
}
