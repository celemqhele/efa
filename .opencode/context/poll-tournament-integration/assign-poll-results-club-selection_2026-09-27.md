# Assign poll results: 2026 SA Club Selection club handover

Assigned the 29 clubs chosen in the closed "2026 SA Club Selection" poll (`f79b9129`) to their winning
managers, opening a fresh tenure for each, immediately after the global tenure reset so the new season
starts from a clean slate.

The user had already closed the poll and asked to review a combined career table first (see the league
table summarised below), then instructed that every manager be released from their current club globally
and that the voted-for clubs then be handed out. This is the payoff step of the poll that
`.opencode/context/poll-tournament-integration/poll-voters-swap-placements-ghost-parmalat_2026-09-26.md`
and `.opencode/context/poll-tournament-integration/poll-voters-swap-ozilotf-blessing-injury_2026-09-27.md`
had been seeding.

## What was done

`supabase/migrations/assign_sa_club_selection_poll_results.sql` — one atomic data-modifying CTE
(`resolved` → `assigned` UPDATE … RETURNING → INSERT) that:

1. Ranks each applicant's `poll_applications` by `created_at` (tie-broken by `id`) and keeps `pick_order = 1`.
2. Matches the pick to a `teams` row on `logo_league_folder = poll.team_league` AND
   `logo_team_slug = slugified poll.team_name`.
3. Sets `teams.manager_id` on those clubs, guarded by `AND t.manager_id IS NULL` so it can never seize a
   club from someone who already holds it.
4. Inserts a `manager_tenures` row (`started_at = now()`, W/D/L/GF/GA left at DB defaults `0`), guarded by
   `NOT EXISTS (open tenure for that manager)` so re-running is safe.

## "First pick wins" — the three double applications

Three managers applied for two clubs each. First pick = earliest `poll_applications.created_at`:

| Manager | First pick (assigned) | Timestamp | Second pick (dropped) | Timestamp |
| ------- | --------------------- | --------- | -------------------- | --------- |
| `m_a_s_h_a_u` | Casric Stars (MFC) | 2026-09-26T15:13:22Z | Leicesterford City (MFC) | 2026-09-26T17:16:58Z |
| `hunger_` | Hungry Lions (MFC) | 2026-09-27T12:35:11Z | Leruma (ABC) | 2026-09-27T12:36:42Z |
| `wamashudu` | Orbit College (MFC) | 2026-09-27T16:37:24Z | Jomo Cosmos (ABC) | 2026-09-27T17:20:58Z |

All three first picks happen to be Motsepe Foundation Championship clubs, so both dropped ABC picks
(**Leruma**, **Jomo Cosmos**) and the dropped MFC pick (**Leicesterford City**) remain vacant.

## Final assignments — PSL 12 · MFC 13 · ABC 4

| Division | Club | Manager |
| -------- | ---- | ------- |
| PSL | AmaZulu | `goat_2` |
| PSL | Durban City | `jobe` |
| PSL | Kaizer Chiefs | `parmalat_` |
| PSL | Lamontville Golden Arrows | `minenhle22` |
| PSL | Mamelodi Sundowns | `itumeleng_99` |
| PSL | Milford | `loki` |
| PSL | Orlando Pirates | `calvin` |
| PSL | Polokwane City | `uvesh` |
| PSL | Sekhukhune United | `siyethemba_` |
| PSL | Siwelele | `Terrence` |
| PSL | Stellenbosch | `wandile` |
| PSL | TS Galaxy | `tildedot` |
| MFC | Cape Town City | `celemqhele` |
| MFC | Casric Stars | `m_a_s_h_a_u` |
| MFC | Gomora United | `ozilotf_` |
| MFC | Highbury | `whitey` |
| MFC | Hope | `ourfather_22` |
| MFC | Hungry Lions | `hunger_` |
| MFC | Magesi | `lorne23` |
| MFC | Midlands Wanderers | `phiwayinkosi` |
| MFC | North West University | `amow` |
| MFC | Orbit College | `wamashudu` |
| MFC | The Bees | `dimarco_32` |
| MFC | University of Pretoria | `loneprsly` |
| MFC | Venda FC | `jigsaw_rsa` |
| ABC | Ben 10 | `hlabaking103` |
| ABC | Supersport | `anele_arh` |
| ABC | TUT FC | `vuyo` |
| ABC | Wits Sport | `badbouycee` |

All 29 clubs already existed as `teams` rows with `manager_id = NULL`, so nothing had to be created.
Verified beforehand that none of the three leagues contains sibling/duplicate club rows (the only
duplicate `(logo_league_folder, logo_team_slug)` pairs in the DB are three old 2025-26 EPL clubs —
Crystal Palace, Wolves, Fulham — which are irrelevant here). This matters because the app's assign path
expands to sibling rows sharing that pair; here it resolves 1:1.

## Verification

| Check | Value |
| ----- | ----- |
| Clubs held | 29 |
| Open tenures | 29 |
| Distinct managers on open tenures | 29 |
| Open tenures carrying any W/D/L | 0 (all genuinely fresh) |
| Clubs with a manager but no open tenure | 0 |
| Managers with both a club and an open tenure | 29 |
| `manager_tenures` total | 205 → 234 |

Every one of the 29 tenures starts with `wins + draws + losses = 0`, confirming no career stats leaked in
from the closed tenures.

## Open issues carried forward (not actioned)

- **`ozilotf_` vs `ozilotf` are two separate accounts.** `ozilotf_` (`e4fe958e…`, created 2026-09-03, no
  phone) is the one that applied and now manages **Gomora United**. The injured `ozilotf`
  (`d7093fb0…`, phone `27697333125`, created 2026-08-29) is a different profile that did **not** apply and
  now manages no club. No phone match links them, but the naming and 5-day gap strongly suggest one human
  with two logins. If so, his broken-legs injury does not currently block him, and the club he now holds
  should probably be reassigned or held. See
  `.opencode/context/poll-tournament-integration/poll-voters-swap-ozilotf-blessing-injury_2026-09-27.md`.
- **Only 12 of the 16 PSL-qualified managers applied.** `blessing_100sk`, `siyambonga23`, `skoozz420` and
  `tbhotouch` never voted, so 4 PSL clubs are unclaimed.
- **Six managers had zero career games** at poll close (`hunger_`, `ozilotf_`, `ourfather_22`, `wamashudu`,
  `lorne23`, `dimarco_32`) — no `manager_tenures` rows at all, so career PPG is undefined for them and any
  seeding by record needs a fallback rule.
- **`poll_applications.status` is still `pending`** for all 32 rows; nothing in this change approves or
  rejects them, so the admin applications view will still show them as awaiting review.

## Related

- `.opencode/context/onboarding/global-reset-manager-tenures-season-rollover_2026-09-27.md` — the tenure sweep that ran immediately before this, and why `sacked_at` was not set.
- `.opencode/context/poll-tournament-integration/poll-voters-swap-placements-ghost-parmalat_2026-09-26.md` — the `ghost` → `parmalat_` PSL swap that fixed this poll's 16-man PSL group.
- `.opencode/context/poll-tournament-integration/poll-voters-swap-ozilotf-blessing-injury_2026-09-27.md` — the `ozilotf` → `blessing_100sk` injury swap.
- `.opencode/context/south-african-premiership/add-sa-premiership_2026-08-27.md` — where the PSL/MFC/ABC club rows came from.
