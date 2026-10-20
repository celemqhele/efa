# Recycled the 2026-10-20 verification scratch scripts

Moved the two throwaway verification scripts written during the forfeit / portal
/ backdoor fixes into `.recycle/scripts/`, keeping the working tree clean while
leaving both files fully readable on disk.

Follow-up to `.opencode/context/housekeeping/recycle-idea-and-recruitment-caption_2026-10-18.md`
(which established the `.recycle/` pattern) and used while shipping
`.opencode/context/forfeit-balances/admin-reset-voids-created-balances_2026-10-20.md`,
`.opencode/context/submit-portal/portal-walkover-gave-me-the-win_2026-10-20.md`,
`.opencode/context/auto-finalise/pending-backdoors-resolved-every-02-00_2026-10-20.md`
and `.opencode/context/submit-portal/portal-backdoor-status-visible-again_2026-10-20.md`.

## Problem

Verifying the changes needed two one-off scripts that must not ship in the repo:
one ran the auto-finalise cron in-process with `?dryRun=1` (the route rejects a
plain CLI run because it wants a `NextRequest` and a `CRON_SECRET` header, and
`.env.local` ships an empty secret), and one SSR-rendered the submit portal's
backdoor panel with real rows to prove a `void_game_played` claim still shows a
status card.

## Fix

Moved them out of `scripts/` rather than deleting them, since the File Deletion
Policy forbids permanent deletion. The date was appended to each name so they do
not collide with future scratch runs.

## Restore File Section

| Original Path | Purpose | Recycle Bin Path |
|---|---|---|
| `scripts/_tmp-cron-dryrun.ts` | Ran `app/api/cron/auto-finalise-prev-day` in-process with `?dryRun=1` (temp local `CRON_SECRET`) to verify Pass 1/Pass 2 counts | `.recycle/scripts/_tmp-cron-dryrun_2026-10-20.ts` |
| `scripts/_tmp-portal-backdoor-render.ts` | SSR-rendered `/submit-match/[code]` with `initialAction: 'backdoor'` to confirm `void_game_played` / `pending` claims render a status card and accent note | `.recycle/scripts/_tmp-portal-backdoor-render_2026-10-20.ts` |
| `scripts/_tmp-reminder-postpone-preview.ts` | Re-ran the match-reminder fixture query against production and printed the composed body per reminder type, to confirm only the postponement fixture gets the new note | `.recycle/scripts/_tmp-reminder-postpone-preview_2026-10-20.ts` |

To restore, move either file back and drop the date suffix, e.g.
`Move-Item .recycle\scripts\_tmp-cron-dryrun_2026-10-20.ts scripts\_tmp-cron-dryrun.ts`.
Both import the live repo modules by relative path, so they run as-is from
`scripts/` once restored.
