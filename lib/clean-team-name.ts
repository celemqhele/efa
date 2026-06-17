export function cleanTeamName(name: string | null | undefined): string {
  if (!name) return ''
  return name.replace(/\s+National Team$/i, '').trim()
}
