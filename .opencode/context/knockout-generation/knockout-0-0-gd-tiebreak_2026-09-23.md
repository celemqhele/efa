# Knockout 0-0 rule: highest total tournament GD advances

Date: 2026-09-23
Chain: `knockout-generation/` (follow-up to `knockout-webhook-progression_2026-08-23.md` and
`qf-tiebreak-brugge-barcelona_2026-08-25.md`)

## What was done

New platform rule, per user direction: when a knockout result is submitted as 0-0 (backdoor
0-0 "both teams absent" draw, or any level tie with no winner after all existing
tie-breaks), only the team with the higher **total GD in that tournament** progresses.
Added the tie-break inside the single advancement choke point `advanceWinner`
(`lib/tournament-progression.ts`) so every submission path (WhatsApp result submit, backdoor
approve, backdoor win/override, admin finalise, both cron auto-finalise paths) inherits it.

## Problem

Before this change a 0-0 knockout result produced no winner:

- Single-leg round (`advanceWinner`, non-sibling branch): `homeScore > awayScore` /
  `awayScore > homeScore` both false → `winnerId = null` → `if (!winnerId) return` → the
  next round slot stayed TBC forever. The 0-0 backdoor path `route.ts:2394-2396` (both sides
  submitted → 0-0 draw) and both-absent scripts wrote exactly this.
- Two-leg round: `determineAggregateWinner` (`lib/aggregate.ts`) returns `null` only when the
  aggregate is level, there are no pen scores, AND the leg-2 fallback is also level — i.e.
  any 0-0/0-0 (or 1-1/1-1, etc.) aggregate → nobody advanced.
- Final: `awardTrophy` used `homeScore >= awayScore ? home : away`, so a 0-0 final silently
  crowned the HOME team (a draw default, not a rule).

## Fix

`lib/aggregate.ts` — new async helper `resolveTournamentGdLeader(db, tournamentId, teamA, teamB)`:

- Sums GD (`goals_for - goals_against`) for every **confirmed** fixture result in the
  tournament, returning the team with the higher GD.
- Mirrors the standings engine's `gd_penalty`: both-absent rows (either
  `is_abandoned = true, abandoned_type = 'both'` or `override_reason` containing "both" +
  "absent") contribute **-3 to each side**, matching what managers see on the
  group/league standings page (`goalDifference()` includes `gd_penalty`).
- Returns `null` when GD is tied (no advancement — same as today's behaviour).

`lib/tournament-progression.ts`:

- Both the single-leg branch (0-0 → `winnerId = null`) and the two-leg branch
  (`determineAggregateWinner` → `null`) now fall back to
  `resolveTournamentGdLeader(db, tournamentId, homeTeamId, awayTeamId)` (two-leg uses the
  **leg-1** home/away ids, matching `determineAggregateWinner`'s side convention).
- `awardTrophy` now only gives the trophy to a clear scoreline winner; on a level final it
  resolves via `resolveTournamentGdLeader` instead of defaulting to the home team.

Behaviour change vs before: previously-stuck level ties (0-0/0-0 backdoor, both absent) now
resolve by tournament GD; the existing leg-2-winner fallback for non-level leg-2 aggregate
ties is untouched.

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint --file lib/aggregate.ts --file lib/tournament-progression.ts` → only the
  pre-existing unused-`leg` warning at `lib/aggregate.ts:36`.
- No DB change needed — this is a forward rule (no data backfill; any already-0-0 ties the
  user wants settled can be done as one-off SQL mirroring the pattern in
  `qf-tiebreak-brugge-barcelona_2026-08-25.md`).

## Related files

- Follow-up in the progression chain of
  .opencode/context/knockout-generation/knockout-webhook-progression_2026-08-23.md (the webhook
  paths that call `advanceWinner`) and .opencode/context/knockout-generation/qf-tiebreak-brugge-barcelona_2026-08-25.md
  (previous level-tie ruling that was a manual one-off; this makes a GD rule permanent).
- The 0-0 backdoor "both submitted" score is written at `app/api/webhook/route.ts:2394-2396`;
  the both-absent 0-0 one-off script is documented in
  .opencode/context/backdoor/backdoor-both-absent-16aug_2026-08-17.md.
- Settled-fixture surfacing in the backdoor flow: .opencode/context/backdoor/backdoor-knockout-no-match-found-fix_2026-09-22.md.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |