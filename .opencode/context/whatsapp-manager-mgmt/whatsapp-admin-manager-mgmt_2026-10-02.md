# Admin Manager Management on WhatsApp (assign / sack / promote)

Rebuilt the admin's manager management as three guided WhatsApp flows (`Manage clubs`, `Manage managers`, `Manager tools` → options 7/8/9 in the admin welcome menu), moving all the domain logic out of the 6,300-line webhook into a new testable `lib/manager-mgmt.ts` and turning the web admin's assign/sack routes into thin wrappers over that same service. The admin list commands previously did nothing at all.

## Decisions taken from the user

1. **Cooldown override is an extra explicit step**, mirroring the web admin's override button: option `1` overrides, `2` cancels. Never a silent apply.
2. **Sack affects only the selected club.** A manager can hold clubs in several competitions; sacking one must not sack the rest.
3. **Promotion warns before confirming**, naming the real consequence: the old Division 2 club loses its manager and its remaining fixtures forfeit 3-0.
4. **Manager list is 20 per page** with a name filter, not one long wall of text.

## Problem

- `Manage clubs` / `Manage managers` / `Manager tools` were advertised in the admin welcome menu but the webhook had no handler, so the buttons were dead.
- The only working path was the web admin, which the admin could not reach from a phone.
- The assign/sack logic was duplicated between `app/api/admin/managers/assign/route.ts`, `app/api/admin/managers/sack/route.ts` and the webhook, so behaviour drifted between the surfaces.
- Listing clubs meant querying `teams` directly, which returns one row per competition folder, so a single club appeared two or three times.

## Fix

### `lib/manager-mgmt.ts` (new)

Single source of truth for assign / sack / promote, shared by the webhook and the web admin:

- `getCooldownEndsAt(sacked_at)` — the one-week post-sack ban arithmetic, so both surfaces read the same answer.
- `assignManagerToClub`, `sackManagerFromClub`, `replaceManagerOnClub`, `promoteManagerToClub`.
- `loadActiveClubs`, `listManagerlessClubs`, `listManagedClubsInTournament`, `listFreeManagers` — the list queries, moved out of the webhook specifically so they can be exercised against live data.
- `resolveOrCreateTeam` — kept and shared; the web admin can create a club the site has never seen by logo, WhatsApp never does but shares the function so the paths cannot diverge.

`listFreeManagers` treats a profile as busy if it owns a club via **either** `teams.manager_id` **or** a `tournament_participants` row. The original assign route required both, which would have offered a manager who owns a club through the participants table alone.

### Promotion preflight (`preflightAssign`)

Promotion and sack-with-replacement are both **release-then-assign** sequences, so any guard that only runs after the release strands the manager with no club and leaves the old club managerless. `preflightAssign` runs every destination-side rule (team exists, manager exists, doesn't already own the club, not in cooldown) **before the first write** and writes nothing itself.

Promotion originally had no cooldown check at all, so a recently-sacked manager being promoted would silently lose their Division 2 club and then fail to land in Division 1. It now returns a `SACK_COOLDOWN` outcome that the webhook turns into the same explicit override step the assign path uses. `replaceManagerOnClub` was upgraded from a cooldown-only check to the same shared preflight.

### Session-state hygiene

`whatsapp_sessions` gained 10 `mgmt_*` columns (migration `088_mgmt_session_columns.sql`). Sessions are **upserted, not recreated**, so every flow start now clears the entire selection block.

This was a real bug, not a theoretical one: running assign (picking a manager) and then sack-without-replacement in the same session left `mgmt_selected_manager_id` populated, silently turning "sack without a replacement" into a replacement. Fixed at the source (flow starts clear everything) and again defensively in the no-replacement branch.

### Flows

| Option | Flow | Steps |
| --- | --- | --- |
| 7 | Assign a manager | clubs → manager (20/page + search) → cooldown? → confirm |
| 8 | Sack a manager | tournament → club → with/without replacement → confirm |
| 9 | Promote to Division 1 | club → destination → forfeit warning → confirm |

Manager picking resolves a number against the **current page**, falls back to a name search, supports `NEXT`/`BACK`, and `ALL` to escape a narrowed search back to the full list.

## Verification

`tsc --noEmit` clean; eslint 0 errors (7 pre-existing warnings). A read-only script
(`.recycle/tmp-verify-mgmt-lists_2026-10-02.ts`, nothing written) checked the live
Season 4 data:

- 32 active clubs deduped to 32 unique club keys; div1=15, div2=16, cup-only=1.
- 29 managed / 3 managerless. Flow A lists Hope and Milford; `Vacant` correctly excluded.
- Flow C div-2 candidates: 15. Flow C div-1 targets: Milford.
- Free managers 47 across 3 pages, **0 club owners leaking in**.
- Cooldown gate asserted at boundaries including exactly-7-days-ago (not in cooldown),
  matching the original route's `> Date.now()` semantics.

No manager is currently in cooldown on live data, so the override step could not be
exercised end-to-end without writing; it was verified by asserting `getCooldownEndsAt`
directly instead.

## Restore File Section

- `scripts/tmp-verify-mgmt-lists.ts` — read-only verification of the list queries and
  cooldown arithmetic against live Supabase. Moved to
  `.recycle/tmp-verify-mgmt-lists_2026-10-02.ts`.