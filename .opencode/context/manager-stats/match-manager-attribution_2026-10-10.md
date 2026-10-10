# Match pages: show the manager who was in charge on the match date

Match detail pages (`/fixtures/[id]`, `/results/[id]`) now attribute each side to
the manager who actually managed the club **on that match's date**, resolved from
`manager_tenures`, instead of the club's *current* manager. A manager who has since
been sacked or replaced keeps their name on the games they played, and each match is
correctly split between the old and new manager of the club. No DB migration was
needed — the full tenure history (earliest `started_at` 2026-05-22, matching the
first fixtures) already covers the season.

## Problem

The fixture and result hero blocks joined `teams.manager_id -> profiles` and printed
`team.manager.username`. That reflects only the club's **current** manager, so once a
manager was sacked the join returned nothing and the scoreline showed the empty
placeholder (`—` / `NO MANAGER`) as if nobody had been there at the time. Historical
matches also all showed the latest manager, so a club with a mid-season change had
every old result credited to the new manager.

The user pointed out the correct source already exists: `manager_tenures`
(`team_id`, `manager_id`, `manager_username`, `started_at`, `ended_at`) records every
manager spell per club row, including backdated tenures, so attribution can be
reconstructed for the whole season.

## Fix

### New resolver — `lib/match-manager.ts`

`resolveMatchManagers(db, sides)` takes `{ teamId, matchDate }` pairs and returns the
matching `{ id, username }` per side:

- Loads all `manager_tenures` rows for the involved team ids in one query.
- A tenure covers a date when `started_at < end of match day` AND (`ended_at` is null
  OR `ended_at > start of match day`) — an interval-overlap test so a same-day
  start/sack still counts, evaluated in UTC against the `date` column with a 24h
  window.
- Picks the covering tenure with the latest `started_at` (there should be exactly one;
  verified no team has two open tenures).
- Returns `{ id: null, username: null }` when no tenure covers the date — a genuinely
  managerless spell (e.g. the window after a sack before the next appointment), which
  the UI renders as `—` / `NO MANAGER`.
- When a fixture has no `scheduled_date` yet (TBC knockout), it falls back to the
  club's open tenure, i.e. its current manager.

Uses the denormalised `manager_username` so a sacked manager's name survives even if
their profile is later changed.

### Wiring

- `app/(public)/fixtures/[id]/page.tsx`: keeps `homeManager` / `awayManager` (current,
  from `teams.manager_id`) for permissions (`isHomeManager`/`isAwayManager`), score
  confirmations (`conf1`/`conf2`) and the Matchroom instructions — changing a sacked
  manager to be able to submit would be wrong. Adds `homeMatchManager` /
  `awayMatchManager` from `resolveMatchManagers` for the hero.
- `app/(public)/fixtures/[id]/_desktop.tsx` and `_mobile.tsx`: hero manager lines now
  read `homeMatchManager`/`awayMatchManager`; the Matchroom block intentionally still
  reads the current `homeManager`/`awayManager` (the people who will actually play the
  upcoming match).
- `app/(public)/results/[id]/page.tsx`: resolves both sides and passes
  `homeMatchManager` / `awayMatchManager`.
- `app/(public)/results/[id]/_desktop.tsx`: hero manager lines now read the resolved
  values. `_mobile.tsx` never showed a manager, so it is unchanged.

The team page (`app/(public)/teams/[id]/page.tsx`) already labels its manager card
"Current manager" and lists the full tenure history separately, so it was left as is.

## Verification

- `npx tsc --noEmit` clean, `npx next lint` clean (pre-existing warnings only),
  `npx next build` succeeded (all `/fixtures/[id]`, `/results/[id]` and admin mirror
  routes emitted).
- Against Supabase: for sacked clubs (`teams.manager_id IS NULL`) the resolver returns
  the era-correct manager (e.g. Sweden 2026-08-30 -> `siyambonga23`, Brazil -> `tildedot`,
  Real Madrid 2026-08-15 -> `Obakeng`, Como 1907 2026-07-23 -> `wandile`).
- Coverage: 3970 / 4046 fixture sides have a covering tenure; the 76 uncovered are
  genuine managerless gaps, placeholder clubs with no tenure (`Vacant`, `No Name`,
  `Cobalt FC`, `Atlas Lions`) or short vacancy windows (e.g. Liverpool 8-17 Aug).
