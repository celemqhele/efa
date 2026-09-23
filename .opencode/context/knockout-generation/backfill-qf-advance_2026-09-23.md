# Backfill QF advance script for International Cup knockout bracket

New one-off script `scripts/backfill-qf-advance.ts` that fills the QF
(matchday 101–104) team slots of the International Cup bracket from the
confirmed R16 results, mirroring the app's single-leg progression logic.

## Problem
The 8 R16 results were confirmed but bracket progression to the QF fixtures
was never run, so the QF home/away team ids were still null (TBC).

## Fix
`scripts/backfill-qf-advance.ts` (one-off, run with
`npx tsx scripts/backfill-qf-advance.ts`):
- Reads R16 fixtures (matchdays 51–58) for tournament
  `e2c61a3e-072e-4a07-8024-76de20c2a99a` and their confirmed results.
- Maps single-leg winners to QF slots: 51→101 home, 52→101 away, 53→102 home,
  54→102 away, 55→103 home, 56→103 away, 57→104 home, 58→104 away.
- Winner = higher score; drawn fixture advances nobody (logged in `skipped`).
- Updates the QF `home_team_id` / `away_team_id` via service role, then prints
  a summary of the QF after the fill.

## Gotchas / Notes
- Mirrors `lib/tournament-progression.ts` mapping — keep them in sync if the
  bracket layout changes.
- Reads `.env.local` / `.env.supabase` for URL and service-role key.

## Related files
- `scripts/backfill-qf-advance.ts`
- `lib/tournament-progression.ts`
- Chain: `.opencode/context/knockout-generation/qf-tiebreak-brugge-barcelona_2026-08-25.md`
  and `.opencode/context/knockout-generation/knockout-webhook-progression_2026-08-23.md`

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |