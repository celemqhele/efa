# User-based (slot-owned) competitions — full implementation

## Intro
Converted EFA competitions from team-owned to **user-based (slot-owned)**: every `tournament_participants` row is a permanent seat owned by a user (`user_id`); `team_id` is a display attribute that follows the owner. Standings, group standings and fixtures render the slot's *current* team; a sack frees the slot as a **Vacant** seat instead of erasing the team from the table; vacant seats stay open for **self-serve season applications** on the web profile and in WhatsApp, reviewed by admins on a new page. Migration applied to the live DB (including the International Cup), all creation routes use slots, and a cron auto-plays default results for vacant seats so leagues don't stall.

## Problem
- A tournament seat was a **team row** (`manager_id` on `teams`): when a manager left mid-competition, the seat vanished from the competition (standings/fixtures deleted), and there was no way for a new manager to take over that seat without admins hand-rebuilding it.
- There was no self-serve route for a player to sign up for the next season; onboarding (`manager_applications`) only handled brand-new accounts and admins assigned teams manually.

## Design decisions
- **Slot model**: `tournament_participants` = slot keyed by `(tournament_id, participant_id)` in `standings`/`group_standings`; fixtures carry `home/away_participant_id` alongside the team copy.
- **No user without a team**: creation only picks users who manage a club; applications always resolve a club. Vacant slot = `user_id IS NULL` + `team_id` = Vacant placeholder (`custom/vacant`).
- Sack → slot becomes Vacant with **stats untouched** (continuity in table); `manager_tenures` career stats untouched. Cooldown: sacked profiles blocked for 7 days (`SACK_COOLDOWN_MS`), admin can override.
- **Applications target the Season** (league+UCL+UEL = unit). Applicant picks an **unmanaged club from the season's allowed leagues**; approval fills the earliest vacant seat, hands over the chosen club (releasing any prior clubs), leaves the rest of their season slots untouched, and denies other pending season applications.
- Vacant slots keep playing: hourly **vacant-sweep cron** saves default results (0-3 / 3-0 / both-void 0-0) for past-due scheduled league/group fixtures so opponents get their points and the table keeps moving.
- Excluded from slots/applications: friendly matches, standalone cups without a season, KO rounds (vacant KO legs handled manually in fixture management).

## Migration

### 066 — `supabase/migrations/066_user_based_slots.sql` (applied, 739 lines)
- Seed `Vacant` team (`custom/vacant`).
- `tournament_participants.user_id` + partial unique `(tournament_id, user_id) WHERE user_id IS NOT NULL`.
- `standings/group_standings.participant_id`; fixtures `home/away_participant_id`; full backfills.
- Standings re-keyed: `UNIQUE(tournament_id, participant_id)`; group: `UNIQUE(tournament_id, group_name, participant_id)`.
- `tournament_applications` table + RLS (`ta_select_own_or_admin`, `ta_insert_own`, `ta_admin_all`) + grants + daily expiry cron (`expire-tournament-applications`).
- Result-confirmation RLS extended to slot owners; `check_result_confirmations()` rewritten (slot owner first, team manager fallback).
- `update_standings_after_result()` rewritten as slot-keyed upsert (group: `(tournament_id, group_name, participant_id)`, league: `(tournament_id, participant_id)`) with defensive participant creation, absent/void handling and predictions scoring preserved.
- Atomic RPCs (`update_standings_atomic`, `update_standings_for_result`) re-keyed to `participant_id`.
- Verified live: 177 participants / 31 owned / Vacant exists; 0 standings, group standings or fixtures missing participant refs; all three constraints present; `is_admin()` and `pg_cron` present.

### 067 — `supabase/migrations/067_vacant_sweep.sql` (applied)
- `sweep_vacant_slots()` (SECURITY DEFINER): finds scheduled league/group fixtures, past-due, side = Vacant team, no result yet → inserts default result (reason written via the `'absent'` phrasing with `is_abandoned = false` so the Vacant placeholder never accrues `abandon_count` and the real opponent is never flagged absent). Flows through the `update_standings_after_result` trigger. Scheduled hourly (`sweep-vacant-slots`, active). One-time run after apply: **0 fixtures swept** (nothing overdue).

## Code changes
- `lib/standings-engine.ts`: participant-keyed recalc; `inferGroups` by participant connectivity (KO results excluded from standings). Typechecked clean; live smoke on International Cup recalc produced 32 participant-keyed group rows with the existing table preserved.
- `lib/slot-utils.ts` (new): `getVacantTeamId`, `releaseClubsOfManager`, `giveClubToManager`, `resolveUserClubId`, `vacateUserSlots`, `fillVacantSlot`, `getProfileUsername`, `approveSeasonApplication`, `stampFixtureParticipants`, `withAdminClient`, `SACK_COOLDOWN_MS`. Club transfer mirrors the old `applyManagerAssignment` in `app/api/webhook/route.ts:2369`.
- `lib/season-applications.ts` (new): `listOpenSeasons` (active seasons with ≥1 vacant seat), `getSeasonPickableTeams` (unmanaged clubs whose league/slug appears among the season's participants), `userInSeason`.
- `lib/supabase/types.ts`: manual updates for `tournament_applications`, `tournament_participants.user_id`, fixture participant refs, standings/group `participant_id`.
- **Creation routes** all slot-aware: `app/api/admin/create-tournament` (`users[]`), `start-phase` (`league_users`), `start-season` (`*_user_ids` + `resolveSlots`), `generate-fixtures`, `tournament-draw` (group upsert conflict target), `start-tournament` (cup slots inherit league slot `user_id`), `lib/tournament-progression.ts` (KO + super cup fixtures `stampFixtureParticipants`).
- **Sack → vacancy**: `vacateUserSlots` added to `checkAndAutoSack` in `app/api/admin/finalise-result/route.ts` and to `app/api/admin/managers/sack/route.ts` (audit log includes `slots_vacated`).
- **API**: `app/api/tournament-applications/route.ts` POST (validates open season, not already in season, no duplicate pending, team unmanaged + part of season universe, `expires_at` +7d); `app/api/admin/tournament-applications/approve|deny|list/route.ts`.
- **Profile UI**: `app/(protected)/profile/ApplyToSeason.tsx` (radio list of open seasons → club select + quick-pick chips → submit) wired into `_desktop.tsx` / `_mobile.tsx`; `page.tsx` feeds `openSeasons`, `seasonPickable`, `pendingSeasonIds`, `inSeasonIds`.
- **Admin UI**: `app/(admin)/admin/tournament-applications/page.tsx` + `_review.tsx` (pending list, vacant-seat badge per season, approve/decline with sack-cooldown override confirm); added to `ACTIONS` in `admin/dashboard/_desktop.tsx` and `_mobile.tsx` ("Applications").
- **WhatsApp**: welcome menu gained option 5 "Tournament applications"; new commands (`tournament applications`, `apply for a seat`, etc.); end-to-end flow in `app/api/webhook/route.ts` (list pending → open seasons → club pick → confirm → insert + notify admins). Admin appointments even load season-open-seat counts live.
- **Display parity**: `getPlaceholderIcon` in `components/ui/TeamLogo.tsx` renders the ShieldQuestion placeholder for the `vacant` slug (standings/fixtures show "Vacant" labels automatically since `team_id` follows the slot).

## Verification
- `npx tsc --noEmit`: clean. `npm run lint`: clean on new/changed code (only pre-existing warnings). `npm run build`: succeeds.
- Live smoke (`scripts` tmp, recycled): `listOpenSeasons` returns nothing while the only open season ("Phase 1") is `upcoming` — empty-state path verified; `tournament_applications` table reachable. The standalone International Cup has no `season_id` and is correctly excluded (applications are season-scoped).
- Migration 067 applied; crons `expire-tournament-applications` + `sweep-vacant-slots` both `active`; one-time sweep = 0.

## Restore File Section
- `scripts/_tmp_recalc_smoke.ts` → moved to `.recycle\_tmp_recalc_smoke.ts_2026-08-30.ts` (recalc smoke after engine rewrite; restore with `git checkout` if needed).
- `scripts/_tmp_apps_smoke.ts` → moved to `.recycle\_tmp_apps_smoke.ts_2026-08-30.ts` (season-applications live smoke; restore with `git checkout` if needed).

## Cross-references
- Onboarding / manager-applications precedent: `.opencode/context/onboarding/onboarding-and-manager-applications_2026-08-15.md`, `.opencode/context/onboarding/manager-data-transfer_2026-08-25.md`
- Knockout progression / super cup (goes through `lib/tournament-progression.ts`): `.opencode/context/knockout-generation/auto-super-cup-generation_2026-08-25.md`

## Notes / follow-ups
- When the "Phase 1" season flips to `active`, vacant seats (from sacks/transfers) will start appearing to applicants; the sweep will keep its fixtures moving.
- Deferred (not implemented): flow to *fill* a vacancy via WhatsApp by admin; polls-team import into slots; repeated-club-name cosmetics in league pickers.