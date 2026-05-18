'use client'

// Uses html-to-image — browser only
export async function exportElementAsPng(
  elementId: string,
  filename: string
): Promise<void> {
  const { toPng } = await import('html-to-image')
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element #${elementId} not found`)

  const dataUrl = await toPng(element, {
    quality: 1,
    pixelRatio: 2,
  })

  const link = document.createElement('a')
  link.download = `${filename}.png`
  link.href = dataUrl
  link.click()
}

export type BroadcastTemplate =
  | 'league_table'
  | 'fixture_card'
  | 'result_graphic'
  | 'group_table'
  | 'gameweek_summary'

export const TEMPLATE_IDS: Record<BroadcastTemplate, string> = {
  league_table: 'broadcast-league-table',
  fixture_card: 'broadcast-fixture-card',
  result_graphic: 'broadcast-result-graphic',
  group_table: 'broadcast-group-table',
  gameweek_summary: 'broadcast-gameweek-summary',
}
