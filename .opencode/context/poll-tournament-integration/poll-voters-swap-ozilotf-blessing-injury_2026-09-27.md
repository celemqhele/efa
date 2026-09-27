# Poll voters: ozilotf injury swap, blessing_100sk into Premiership

Promoted `blessing_100sk` (Cote D Ivoire) into the Premiership group on the "2026 SA Club Selection" poll
and moved the injured `ozilotf` (Panama) down to Motsepe/ABC, keeping the Premiership group at 16 against
16 PSL clubs, then regenerated the placement announcement PDF to match.

After the earlier `ghost` → `parmalat_` swap, the user asked for the manager directly below `parmalat_` on
the combined board to also go to the Premiership, and reported that `ozilotf` was in hospital recovering
from broken legs and could not participate in any tournament until further notice.

## Problem

The Premiership has 16 clubs, so exactly 16 managers may hold a Premiership slot.

After the prior swap (`.opencode/context/poll-tournament-integration/poll-voters-swap-placements-ghost-parmalat_2026-09-26.md`)
the Premiership group held 16 managers. `blessing_100sk` sat at rank 18, the next manager below `parmalat_`
at rank 17, so promoting them pushed the group to 17 claimants for 16 clubs.

Relevant slice of the combined EFA International Cup group-stage board (points, then goal difference, then
goals for, per `rankTournamentManagers` in `lib/poll-voter-restrictions.ts`):

| Rank | Manager | Country | Pts | GD |
| ---- | ------- | ------- | --- | -- |
| 14   | ozilotf | Panama | 9 | +2 |
| 15   | calvin  | Spain | 9 | -1 |
| 16   | parmalat_ | England | 9 | -11 |
| 17   | blessing_100sk | Cote D Ivoire | 7 | +3 |

Note this board ordering differs from array position in the announcement script — `ozilotf` is rank 14 and
`calvin` rank 15 here, whereas the script lists `ozilotf` at index 13 and `calvin` at index 14, and
`parmalat_` is rank 16 by the board but index 15 in the script. Compare managers by name, not by index.

## Fix

Two migrations, applied in order, each replacing a single `polls.voter_restrictions` JSONB array wholesale:

1. `supabase/migrations/promote_blessing_100sk_to_premiership.sql` — `blessing_100sk`
   (`8f3a9489-8c31-421d-91bc-b890088ed44d`) → `south-african-premiership-2026-2027.football-logos.cc`.
2. `supabase/migrations/demote_ozilotf_for_injury.sql` — `ozilotf`
   (`d7093fb0-2e3b-469d-9d89-6358b212a7c5`) →
   `["motsepe-foundation-championship-2026-2027.football-logos.cc","abc-motsepe-league-2026-2027.football-logos.cc"]`.

Verified end state on poll `f79b9129`: 16 Premiership, 69 Motsepe/ABC, 85 total voters. `parmalat_` stays in
the Premiership and `ghost` stays out, preserving the earlier swap. The PSL group was cross-checked in SQL
against the 16 names in the announcement script's Premiership block and matched exactly in both directions.

### No profile status change for the injury

Deliberately left `profiles.sacked_at` null and left the `manager_tenures` row open. `sacked_at` is the only
status-like column on `profiles`, but it means *permanently sacked* and feeds vacancy, forfeit, and Hall of
Fame logic, so it is the wrong flag for a temporary injury. Ending the tenure would also risk triggering
auto-forfeit or vacant-display behaviour described in
`.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md`. The injury is
tracked in this context file only until the app grows a real temporary-unavailable status.

### Announcement PDF

Mirrored the swap into `scripts/guide/placement-announcement.tsx` by moving the `blessing_100sk` row up into
the Premiership block and the `ozilotf` row down into the Motsepe block. The `MANAGERS` array is a flat 32
rows with `PSL = MANAGERS.slice(0, 16)` and `MOTSEPE = MANAGERS.slice(16)`, so a two-row swap preserves the
16/16 split with no change to the slice logic. Then ran `npm run generate-announcement-pdf` to rewrite
`public/EFA-Announcement-LeaguePlacement.pdf`.

The array is not sorted by points, because each swap leaves the displaced manager sitting out of rank order
(`ghost` has 10 pts at index 16, below `parmalat_` on 9 pts at index 15). That cosmetic quirk is pre-existing
from `.opencode/context/poll-tournament-integration/poll-voters-swap-placements-ghost-parmalat_2026-09-26.md`;
this change continues it rather than re-sorting the whole array, which would reorder ranks in the published PDF.

## Restore File Section

No files were removed or moved.
