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
