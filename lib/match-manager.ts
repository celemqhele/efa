type Db = any

export interface MatchManager {
  id: string | null
  username: string | null
}

interface SideRef {
  teamId: string | null | undefined
  matchDate: string | null | undefined
  // When the current result was recorded (`results.updated_at ?? created_at`).
  // A tenure that started at or after this moment cannot own the result, which
  // is what stops an automatic forfeit stamped hours before a new manager was
  // assigned from being credited to that manager. Omit for fixtures that have
  // no result yet: the latest tenure on the match day then owns the fixture.
  decidedAt?: string | null
  // `results.finalised_by` is null for results the system produced itself
  // (managerless/vacant forfeits, auto 0-0 placeholders) rather than a person.
  // Those never fall back to match-day attribution when they were stamped before
  // the fixture's day; human results do, because a pre-entered (early/backdoor)
  // score says nothing about who played.
  systemResult?: boolean
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
// ended by the start of that day (same-day sack/start still counts). When the
// caller also passes `decidedAt` (the moment the result was recorded), the
// tenure must additionally have started before that moment: a same-day handover
// is split by time, so the automatic forfeit booked against the club before the
// new manager arrived stays with the old era instead of being charged to the
// newcomer. The exception is a HUMAN result recorded before the fixture's day
// (`systemResult` false) - that is a pre-entry, so the match day alone decides.
// The latest qualifying tenure wins (id breaks exact ties), mirroring
// recalc_tenure_stats() in SQL so the hero matches the stored stats.
//
// When a fixture has no scheduled date yet (TBC knockout), the club's open
// tenure is used, i.e. its current manager.
export async function resolveMatchManagers(db: Db, sides: SideRef[]): Promise<MatchManager[]> {
  const teamIds = Array.from(
    new Set(sides.map((s) => s.teamId).filter((x): x is string => !!x))
  )
  if (teamIds.length === 0) return sides.map(() => EMPTY)

  const { data } = await db
    .from('manager_tenures')
    .select('id, team_id, manager_id, manager_username, started_at, ended_at')
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

    const decidedMs = side.decidedAt ? Date.parse(side.decidedAt) : NaN
    const hasDecidedAt = !Number.isNaN(decidedMs)
    // A human result stamped before the fixture's day is a pre-entry: the
    // timestamp is not evidence of who played, so match-day attribution applies.
    const preEnteredHumanResult =
      hasDecidedAt && !side.systemResult && decidedMs < dayStart

    let best: any = null
    for (const row of rows) {
      const started = Date.parse(row.started_at)
      if (Number.isNaN(started) || started >= dayEnd) continue
      if (row.ended_at) {
        const ended = Date.parse(row.ended_at)
        if (!Number.isNaN(ended) && ended <= dayStart) continue
      }
      // The tenure must exist before the result was decided (see above).
      if (hasDecidedAt && !preEnteredHumanResult && started >= decidedMs) continue
      if (!best) {
        best = row
        continue
      }
      const bestStarted = Date.parse(best.started_at)
      if (
        started > bestStarted ||
        // Same instant: a later row is the later tenure (SQL tie-break).
        (started === bestStarted && String(row.id) > String(best.id))
      ) {
        best = row
      }
    }

    return best
      ? { id: best.manager_id ?? null, username: best.manager_username ?? null }
      : EMPTY
  })
}

export async function resolveMatchManager(
  db: Db,
  teamId: string | null | undefined,
  matchDate: string | null | undefined,
  decidedAt?: string | null
): Promise<MatchManager> {
  const [manager] = await resolveMatchManagers(db, [{ teamId, matchDate, decidedAt }])
  return manager
}
