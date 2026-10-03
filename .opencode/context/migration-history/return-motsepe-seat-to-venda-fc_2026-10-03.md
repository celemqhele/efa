This session re-stabilised Motsepe division 2 after Golden Arrows was left holding both a Premiership seat and a Motsepe seat. 

The core issue was that reclaimManagerSlots() mutates an existing tournament_participants row in place (slot-follows-team), so jigsaw_rsa vacating Venda FC caused the reused Motsepe seat to be re-pointed to Lamontville Golden Arrows. The same seat's fixture history showed Venda FC playing MD1/MD9, then becoming Vacant, then the seat being occupied by Golden Arrows — so the fix is a restore, not an insertion.

**What we did:**

- Identified the duplicate membership: Golden Arrows held seat `601b4cf7` (Betway Premiership, div1, owned by jigsaw_rsa) and seat `1e37bed4` (Motsepe Foundation Championship, div2, owned by jigsaw_rsa) — effectively the only club appearing in both divisions. 
- Confirmed standings-core.ts resolveSide() prefers participant membership, so repointing the seat is sufficient to re-attribute fixtures without rewriting played games.
- Added migration `089_return_motsepe_seat_to_venda_fc.sql` to repoint seat `1e37bed4` to team `Venda FC` (`b874ffb5`), set `user_id=NULL`, `vacated_from_team_id=NULL`, updated pending fixtures' team_id copies where appropriate, and refreshed standings/group_standings participant pointers. Ran it successfully.
- Verified post-migration: div2 has 16 seats, 16 distinct clubs, no Golden Arrows. The seat is managerless; 25 Motsepe + 1 Nedbank R32 remaining fixtures were assigned to Venda FC via the seat.
- Ran `npx tsx scripts/forfeit-managerless-clubs.ts --club "Venda FC"` to stamp 26 automatic forfeits (25 league + 1 cup). 
- Checked Motsepe standings after recalc via `lib/standings-engine.ts` and confirmed engine logic (absent/void records `absent`/`gd_penalty` without counting as W/D/L) is consistent. Venda FC's record is correct under that model (played 6, 2W 0D 1L + 3 absences).
- Cup R32 fixture remains `confirmed_pending` with absent-forfeit result; won't advance until flip-pending runs. Golden Arrows has no remaining fixtures in div2.
- Retired the temporary recalc script by moving it to `.recycle/` (per repo policy).

**State after this change:** 
- Motsepe div2 clean (one club per seat). 
- Venda FC holds the Motsepe seat but is managerless (as intended). Hungry Lions also remains managerless in div2. 
- Forfeits created for all remaining Venda FC fixtures; they will be flipped to `confirmed` on their matchday windows by the existing flip-pending schedule.
- No cross-division seat hijack remains for Golden Arrows.

**Next checks (if desired):** 
- Run `scripts/forfeit-managerless-clubs.ts --dry-run` to confirm only the intended managerless clubs with remaining fixtures remain. 
- Inspect `reclaimManagerSlots()` (`lib/slot-utils.ts`) and `loadActiveClubs()` (`lib/manager-mgmt.ts`) for the nondeterministic division assignment mentioned in the session briefing (cross-division reclaim path) — that was the root cause; the restoration is done, but a guard is warranted. 

**Files changed:** 
- Created: `supabase/migrations/089_return_motsepe_seat_to_venda_fc.sql`
- Moved to recycle: `scripts/tmp-recalc-motsepe.ts`
- Context file: this document (`.opencode/context/migration-history/return-motsepe-seat-to-venda-fc_2026-10-03.md`)
