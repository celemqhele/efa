export interface ForfeitAdjustedScore {
  home: number
  away: number
}

export function parseForfeitAdjusted(note: string | null | undefined): ForfeitAdjustedScore | null {
  if (!note) return null
  const match = /adjusted from\s+(\d+)\s*[-–—]\s*(\d+)/i.exec(note)
  if (!match) return null
  const home = Number(match[1])
  const away = Number(match[2])
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null
  return { home, away }
}

export interface ForfeitNoteEntry {
  fixtureId: string
  text: string
}

// A result can carry more than one applied carry-over balance. Each one is
// stored as its own `forfeit_note:<fixtureId>:<sentence>` line so every source
// match can be cited (one "Open the match" link each) instead of only the last.
export function parseForfeitNotes(raw: string | null | undefined): ForfeitNoteEntry[] {
  if (!raw) return []
  const entries: ForfeitNoteEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line.startsWith('forfeit_note:')) continue
    const rest = line.slice('forfeit_note:'.length)
    const sep = rest.indexOf(':')
    if (sep === -1) continue
    const fixtureId = rest.slice(0, sep)
    const text = rest.slice(sep + 1)
    if (fixtureId && text) entries.push({ fixtureId, text })
  }
  return entries
}
