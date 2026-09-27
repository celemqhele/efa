# Poll Voter Restrictions — New Users Locked Out (Post-Snapshot Drift) — 2026-09-27

Fixed restricted polls locking out users whose profile was created after the `voter_restrictions` allowlist snapshot. New users now default to the second-division folders (Motsepe Foundation Championship + ABC Motsepe League) instead of being blocked, so they can vote on the "2026 SA Club Selection" poll without gaining Premiership access. Follow-up regression on the static-allowlist design introduced in `.opencode/context/poll-tournament-integration/poll-voter-restrictions-and-season-import-split_2026-09-22.md` and expanded in `.opencode/context/poll-tournament-integration/poll-voters-all-members-motsepe-abc_2026-09-26.md`.

## Problem
- `voter_restrictions` (JSONB `user_id → [league_folder,...]`) on the SA Club Selection poll (`share_code` `f79b9129`) is a static snapshot built from the 85 existing profiles on 2026-09-26. Any user who created their account after that snapshot is absent from the map.
- Absent users were treated as ineligible by both enforcement paths:
  - `app/api/polls/[share_code]/apply/route.ts` returned 403 "You are not eligible for this poll" when `restrictions[user.id]` was missing/empty.
  - `app/(public)/polls/[share_code]/page.tsx` computed `allowedFolders = restrictions[user.id] ?? []` → `isEligible = false` → the ineligible notice instead of the team list.
- Users created minutes ago reported being restricted from the poll.

## Fix / Actions
- `lib/poll-voter-restrictions.ts`: added `resolveVoterFolders(restrictions, userId)` — returns `null` for unrestricted polls (legacy open behavior), the user's folders verbatim when present in the map, and the **fallback default `[SA_MOTSEPE_FOLDER, SA_ABC_FOLDER]`** when the poll is restricted but the user isn't in the map (second-division default, never unlocks the Premiership folder).
- `app/api/polls/[share_code]/apply/route.ts`: replaced the manual `restrictions[user.id]` lookup with `resolveVoterFolders` inside the existing `if (restrictions)` guard. Missing users now get the Motsepe/ABC folders and can apply to those teams only.
- `app/(public)/polls/[share_code]/page.tsx`: `allowedFolders = user ? resolveVoterFolders(restrictions, user.id) : null`, same fallback behaviour — new users see the Motsepe/ABC team list and `isEligible` is true for them.

## Verification
- `npx tsc --noEmit` clean; `npx eslint` clean on all three touched files.
- Confirmed only one restricted poll exists (`f79b9129`, 85 voters in the map, `allowed_leagues` = the 3 SA folders), so the fallback default is scoped correctly.
- Admin split view (`app/(admin)/admin/polls/page.tsx`) `isPslVoter` already returns false for users absent from the map, so a new user's application would group under "Motsepe (Championship + ABC)" — consistent with the fallback.

## Notes / Caveats
- The fallback is a runtime default and does not mutate `voter_restrictions`, so the stored allowlist stays as the source of truth for the originally-placed 32 managers + later additions. If we ever need new profiles to appear in the map itself (e.g. for the season-import split), a re-run snapshot migration like `add_poll_voters_motsepe_all.sql` would be needed.
- `app/api/polls/[share_code]/route.ts` still strips `voter_restrictions` from the public poll payload (unchanged).
- No deletion involved → no Restore File Section.

## Context chain (by path)
- Voter restrictions feature + static allowlist design: `.opencode/context/poll-tournament-integration/poll-voter-restrictions-and-season-import-split_2026-09-22.md`
- All-85-profiles expansion (the snapshot this fix covers): `.opencode/context/poll-tournament-integration/poll-voters-all-members-motsepe-abc_2026-09-26.md`
- Placement swap: `.opencode/context/poll-tournament-integration/poll-voters-swap-placements-ghost-parmalat_2026-09-26.md`
- Admin split view: `.opencode/context/admin-dashboard/admin-polls-psl-motsepe-voter-split_2026-09-27.md`