# Admin Polls — PSL/Motsepe Voter Split in Applications View — 2026-09-27

Split the applications list on the admin polls page (`app/(admin)/admin/polls/page.tsx`) into two groups for restricted polls — "PSL (Betway Premiership)" vs "Motsepe (Championship + ABC)" — based on each applicant's `voter_restrictions` folders, instead of one mixed list. Follow-up to the placement swap in `.opencode/context/poll-tournament-integration/poll-voters-swap-placements-ghost-parmalat_2026-09-26.md` and the voter-expansion in `.opencode/context/poll-tournament-integration/poll-voters-all-members-motsepe-abc_2026-09-26.md`.

## Problem
- On the admin polls page, the expanded Applications list for the "2026 SA Club Selection" poll (`share_code` `f79b9129`, `voter_restrictions` allowlist with 85 voters) showed every applicant in one mixed list. With both Premiership-only and Motsepe+ABC managers voting, the admin couldn't tell at a glance which votes came from PSL players vs Motsepe players — important since the two divisions are separate teams.
- The `polls` payload already returned everything needed — the admin GET (`app/api/admin/polls/route.ts`) selects `*` on `polls`, so `voter_restrictions` (JSONB `user_id → [league_folder,...]`) was already present; the page just wasn't using it.

## Fix / Actions
- `app/(admin)/admin/polls/page.tsx`:
  - Imported `SA_PREMIERSHIP_FOLDER` from `lib/poll-voter-restrictions.ts`.
  - Added `voter_restrictions?: Record<string, string[]> | null` to the `Poll` interface.
  - Added `isPslVoter(poll, app)` — returns true when `poll.voter_restrictions[app.applicant_id]` includes `SA_PREMIERSHIP_FOLDER`.
  - Replaced the flat expanded-applications render with a grouped render: when the poll has `voter_restrictions`, applications are bucketed into `PSL (Betway Premiership)` and `Motsepe (Championship + ABC)` with a count header per bucket; unrestricted polls keep the single "Applications" list.
  - The collapsed toggle line now shows the split for restricted polls, e.g. `Applications (14) · PSL 11 / Motsepe 3`.
- No API change needed — `voter_restrictions` already flows through the GET; the grouping is purely a client-side presentation change.

## Verification
- `npx tsc --noEmit` clean. `npx next lint --file` on the page: only the pre-existing `handleExportManager` unused-var warning.
- Confirmed against live data: poll `f79b9129` has `voter_restrictions` present with **85** voters; its 22 non-withdrawn applications map cleanly to a `south-african-premiership-...` folder (PSL) or the two motsepe folders via `jsonb_each`/`voter_restrictions->(id)::text` — so the client split produces correct buckets.

## Notes / Caveats
- The `_shell.tsx` / `_desktop.tsx` / `_mobile.tsx` files in the same folder are orphaned (nothing imports them; `_shell` imports both, but no route references `_shell`) — the live page is `page.tsx`. Left untouched.
- No deletion involved → no Restore File Section.

## Context chain (by path)
- Placement swap that made PSL/Motsepe membership editable: `.opencode/context/poll-tournament-integration/poll-voters-swap-placements-ghost-parmalat_2026-09-26.md`
- Poll opened to 85 voters: `.opencode/context/poll-tournament-integration/poll-voters-all-members-motsepe-abc_2026-09-26.md`
- Voter restrictions feature (the map the split reads): `.opencode/context/poll-tournament-integration/poll-voter-restrictions-and-season-import-split_2026-09-22.md`