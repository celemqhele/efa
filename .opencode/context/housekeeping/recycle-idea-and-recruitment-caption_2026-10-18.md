# Recycled stale scratch files (IDEA.md, recruitment_caption.txt) into .recycle

Moved two stale untracked scratch files, `IDEA.md` and `recruitment_caption.txt`,
into the gitignored `.recycle/` bin to clear an untracked-file pile-up the user
flagged. This also closed out the last of the untracked leftovers by committing
the previously-uncommitted Stellenbosch forfeit-revert fix in the same cleanup.

## Problem

The working tree had four files sitting untracked and local-only, invisible to
repo history:

- `scripts/fix-stellenbosch-forfeit-revert.ts` +
  `.opencode/context/forfeit-balances/revert-stellenbosch-mistaken-forfeit_2026-10-16.md`
  — a **completed fix that had already run against production** in an earlier
  session but was never committed, so the repo had no record of a change that
  actually happened.
- `IDEA.md` — a single-line note, `CHATBOT FOR THE EFA APP`.
- `recruitment_caption.txt` — an 8-line EFootball tournament promo blurb
  ("Would you like to play in our EFootball tournaments? … Join now!").

The user wanted the pile cleared. Note that `git push` only publishes *committed*
work and never touches untracked files, so pushing alone would not have cleared
these.

## Fix

1. **Committed** the Stellenbosch pair as `03692d4`
   (`chore(forfeits): commit Stellenbosch forfeit-revert script + context`),
   since its DB changes were already live and the script + context file were
   complete and valid.
2. **Recycled** the two scratch files by moving them into `.recycle/`, which is
   gitignored (`.gitignore:48`), so they vanish from the untracked pile in
   `git status` while staying intact on disk. Important nuance: `.recycle/` is
   ignored for *new* files — the 125 files there that show as tracked predate the
   ignore rule. So recycled files are **local-only, not committed to git
   history**; that is the intended discard mechanism, not a tracked move.
   Original filenames were preserved so a restore is a plain reverse move.
3. Wrote this context file, and added the `housekeeping/` category to the
   category list in `AGENTS.md`.

Recycling was chosen over the earlier `.gitignore` idea because it relocates the
files out of the working tree rather than leaving them at repo root, and it is
non-destructive — both files' full contents remain on disk under `.recycle/`
(just not version-controlled).

## Restore File Section

| Original Path | Purpose | Recycle Bin Path |
|---|---|---|
| `IDEA.md` | One-line product-idea note: `CHATBOT FOR THE EFA APP` | `.recycle/IDEA.md` |
| `recruitment_caption.txt` | EFootball tournament recruitment promo caption (8 lines, WhatsApp-style) | `.recycle/recruitment_caption.txt` |

To restore either file, move it back to the repo root (e.g.
`Move-Item .recycle\IDEA.md IDEA.md`) — names were kept identical.
