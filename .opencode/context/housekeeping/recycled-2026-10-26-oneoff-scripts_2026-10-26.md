# Recycled the 2026-10-26 one-off account and postponement scripts

Moved the two one-off scripts written across the 2026-10-25/26 account sessions out of
`scripts/` into `.recycle/scripts/`, keeping the working tree clean now that both jobs have
been executed against production. A stray local commit (`4c8b411`, carrying only these two
files under an auth-fix message) was dropped during the rebase onto `origin/main`; the files
were restored byte-identically from that commit (verified with `git hash-object` against
`git rev-parse 4c8b411:scripts/...`) before being recycled, so nothing was lost.

Follows the `.recycle/` pattern established in
`.opencode/context/housekeeping/recycle-idea-and-recruitment-caption_2026-10-18.md` and
`.opencode/context/housekeeping/recycled-2026-10-20-scratch-scripts_2026-10-20.md`. They were
used to ship `.opencode/context/user-management/create-assign-jd_501-supersport_2026-10-26.md`
and the mjitta / Orlando Pirates assignment (context files under
`.opencode/context/user-management/`).

## Problem

While pushing the postponement-attribution work
(`.opencode/context/manager-stats/postponement-placeholder-tenure-spill_2026-10-26.md`), the
local branch would not fast-forward: it carried `4c8b411`, a commit whose message duplicated
the remote auth fix but whose tree only added `scripts/create-assign-jd_501-supersport_2026-10-26.ts`
and `scripts/postpone-request-orlando-pirates-midlands-2026-10-25.ts`. Rebasing onto
`origin/main` and dropping that commit removed them from disk, because they were tracked in
the dropped commit.

## Fix

- Dropped `4c8b411` from the branch (`git rebase --onto 14076da 4163fd6 main`), then restored
  both files with `git restore --source=4c8b411 -- scripts/...` and moved them into
  `.recycle/scripts/` with `Move-Item`, per the File Deletion Policy.
- Content verified identical to the dropped commit
  (`create-assign-jd_501-supersport_2026-10-26.ts` → `00491d1...`,
  `postpone-request-orlando-pirates-midlands-2026-10-25.ts` → `29dc6ee...`).
- `.recycle/` is gitignored, so the working tree is clean; the history now matches
  `origin/main` plus the three intended commits.

## Restore File Section

| Original Path | Purpose | Recycle Bin Path |
|---|---|---|
| `scripts/create-assign-jd_501-supersport_2026-10-26.ts` | Created the `jd_501` auth user + profile and assigned him to Supersport (fallback direct SQL path, documented in `.opencode/context/user-management/create-assign-jd_501-supersport_2026-10-26.md`) | `.recycle/scripts/create-assign-jd_501-supersport_2026-10-26.ts` |
| `scripts/postpone-request-orlando-pirates-midlands-2026-10-25.ts` | Filed the Orlando Pirates vs Midlands Wanderers postponement request / inspected the resulting placeholder for the mjitta session | `.recycle/scripts/postpone-request-orlando-pirates-midlands-2026-10-25.ts` |

To restore, move a file back and drop the date suffix, e.g.
`Move-Item .recycle\scripts\create-assign-jd_501-supersport_2026-10-26.ts scripts\create-assign-jd_501-supersport_2026-10-26.ts`.
Both import live repo modules (`lib/manager-mgmt`, `lib/supabase/server`) by relative path, so
they run as-is from `scripts/` once restored.
