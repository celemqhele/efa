type Db = any

export interface MatchManager {
  id: string | null
  username: string | null
}

interface SideRef {
  teamId: string | null | undefined
  matchDate: string | null | undefined
}

const EMPTY: MatchManager = { id: null, username: null }

const DAY_MS = 24 * 60 * 60 * 1000

// Resolve, for each side of a match, the manager who was in charge of that team
// on the match date — from the club's `manager_tenures` intervals rather than
// the team's CURRENT manager. A finished match therefore keeps the manager from
// its own era after that person is sacked or the club changes hands, so score
// history stays attributed to whoever actually played it. A genuinely
// managerless spell (no tenure covers the date) resolves to null so the UI can
// show the empty "—"/"NO MANAGER" placeholder.
//
// A tenure covers a date when it started on or before the match day and has not
// ended by the start of that day (same-day sack/start still counts). When a
// fixture has no scheduled date yet (TBC knockout), the club's open tenure is
// used, i.e. its current manager.
export async function resolveMatchManagers(db: Db, sides: SideRef[]): Promise<MatchManager[]> {
  const teamIds = Array.from(
    new Set(sides.map((s) => s.teamId).filter((x): x is string => !!x))
  )
  if (teamIds.length === 0) return sides.map(() => EMPTY)

  const { data } = await db
    .from('manager_tenures')
    .select('team_id, manager_id, manager_username, started_at, ended_at')
    .in('team_id', teamIds)

  const byTeam = new Map<string, any[]>()
  for (const row of (data ?? []) as any[]) {
    const list = byTeam.get(row.team_id) ?? []
    list.push(row)
    byTeam.set(row.team_id, list)
  }

  return sides.map((side) => {
    if (!side.teamId) return EMPTY
    const rows = byTeam.get(side.teamId) ?? []
    if (rows.length === 0) return EMPTY

    const dateKey = side.matchDate ? String(side.matchDate).slice(0, 10) : null
    if (!dateKey) {
      // No date yet: fall back to the open tenure (current manager).
      const open = rows
        .filter((r) => !r.ended_at)
        .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0]
      return open ? { id: open.manager_id ?? null, username: open.manager_username ?? null } : EMPTY
    }

    const dayStart = Date.parse(`${dateKey}T00:00:00.000Z`)
    if (Number.isNaN(dayStart)) return EMPTY
    const dayEnd = dayStart + DAY_MS

    let best: any = null
    for (const row of rows) {
      const started = Date.parse(row.started_at)
      if (Number.isNaN(started) || started >= dayEnd) continue
      if (row.ended_at) {
        const ended = Date.parse(row.ended_at)
        if (!Number.isNaN(ended) && ended <= dayStart) continue
      }
      if (!best || started > Date.parse(best.started_at)) best = row
    }

    return best
      ? { id: best.manager_id ?? null, username: best.manager_username ?? null }
      : EMPTY
  })
}

export async function resolveMatchManager(
  db: Db,
  teamId: string | null | undefined,
  matchDate: string | null | undefined
): Promise<MatchManager> {
  const [manager] = await resolveMatchManagers(db, [{ teamId, matchDate }])
  return manager
}
