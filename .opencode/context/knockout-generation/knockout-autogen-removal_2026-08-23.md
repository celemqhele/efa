# Knockout Auto-Generation Removal + Per-Tournament Clarity

## Incident (2026-08-23)

Admin generated UCL knockouts fine, then tried UEL and got
"Knockout fixtures already exist". Suspected a global one-shot gate across
tournaments. Also reported "UEL fixtures show UCL teams" and that fixture
lists only say tournament TYPE ("Tournament (Clubs)") instead of names.

## Root causes

1. **Auto-generation in finalise-result** (`app/api/admin/finalise-result/route.ts`):
   when the LAST group fixture of a `tournament_club`/`tournament_international`
   was confirmed, it silently called `generateTBCKnockouts()` with default
   `num_legs = 1`. UEL's last two group results were finalised at 13:26/13:27 UTC,
   so UEL knockouts were auto-created as SINGLE-leg before the admin ever clicked
   the button → manual click correctly 409'd ("Knockout fixtures already exist").
   Admin wanted 2 legs → auto-gen had "generated the wrong thing".
   (Audit log proves it: only one `generate_knockouts` entry that day = UCL manual;
   UEL's KO fixtures appeared between two `finalise_result` entries.)
2. **Manage-fixtures grouped by tournament TYPE**, not name/id
   (`_desktop.tsx`/`_mobile.tsx` keyed groups by `t.type`). Both active club
   competitions are type `tournament_club`, so their fixtures merged into ONE
   section labelled "Tournament (Clubs)" → looked like mixed competitions.
3. **Phases page (SeasonManager)** picked `uclT = find(type==='tournament_club')`
   and `europaT = find(type==='tournament_international')`. Both real tournaments
   are `tournament_club`, so only ONE tile/button ever rendered ("run through
   1 thing" feeling).
4. **Standings links used wrong query param** `?t=` while the standings page reads
   `?tournament=` → always fell back to first active tournament (Premier League).

## Data facts checked in Supabase

- Active tournaments: Premier League `35adbc8e…` (league), Champions League
  `7174e29f…` (tournament_club), Europa League `80e86b39…` (tournament_club).
  NOTE: Europa being `tournament_club` (not `tournament_international`) is
  historical/correct-ish (club comp) but breaks any code assuming one-per-type.
- Zero team overlap between UCL and UEL participants/fixtures (verified via SQL).
  The "mixed teams" report was purely the grouping-by-type UI issue.
- Old completed same-named tournaments from previous season hold June fixtures;
  all knockout checks are scoped by tournament_id so they never interfered.

## Fixes applied

1. `finalise-result`: removed `generateTBCKnockouts` call + import; group-stage
   confirmations now just recalculate standings. Knockouts are ONLY created by
   explicit admin click (controls timing + leg count).
2. Manage-fixtures (`page.tsx`): respects `?tournament=` param (filters query),
   passes `filterTournament` to Shell; desktop+mobile now group sections by
   tournament ID and show real NAME in section headers (+ small type label).
3. `GenerateKnockoutsButton`: new `hasKnockouts` prop → renders disabled green
   "Knockouts Generated ✓" chip instead of opening modal / erroring later.
   Wired from `admin/tournaments/page.tsx` (koCounts via round_type),
   `admin/tournaments/[id]/page.tsx`, `admin/dashboard` (page.tsx koCounts →
   `_desktop.tsx` card).
4. SeasonManager Phases: renders one tile PER club/international tournament using
   its real name (sorted alphabetically), each with its own Generate KOs button;
   Super Cup dialog wired to `clubTs[0]`/`clubTs[1]`.
5. Fixed `?t=` → `?tournament=` in: standings StandingsSwitcher, admin dashboard
   _desktop, admin tournaments page/_mobile/_desktop/[id].

## DB change performed (2026-08-23)

Deleted UEL's 7 wrong single-leg KO fixtures (4 QF + 2 SF + 1 final, no results
existed) for tournament `80e86b39-1314-403d-ad91-ff7666fdde80`. UEL back to just
40 group fixtures. **Next step for admin:** deploy, then Generate Knockouts on
the EFA Europa League card choosing "2 Legs" (UCL already done as 2-leg).

## Gotchas for the future

- Never key UI groupings by tournament `type` — multiple competitions can share
  a type. Use id + name.
- If adding auto-anything behind result confirmation, log it loudly / surface it
  in UI; silent side-effects caused this whole investigation.

## Related files

- Chain root for the whole `knockout-generation/` folder (08-23 → 08-24 → 08-25 → 08-26).
- This removal is why regeneration was needed: `.opencode/context/knockout-generation/knockout-daily-cap_2026-08-23.md`.
- And why bracket progression had to be wired into non-admin paths: `.opencode/context/knockout-generation/knockout-webhook-progression_2026-08-23.md`.
- Same-era start-tournament flow: `.opencode/context/season-cup-flow/deferred-ucl-uel-start_2026-08-23.md`.
- The `GenerateKnockoutsButton.hasKnockouts` guard here is the precedent referenced later by `.opencode/context/knockout-generation/tournament-autocomplete-and-fixtures-guard_2026-08-26.md`.
