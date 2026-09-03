# List-first, then shortlist — finding context files by filename, not keyword

Changed the "finding context files" rule in `AGENTS.md` to require a **list-first, then shortlist** approach: always list all context files and pick candidates by file **name** (and category folder) before ever doing a content keyword-grep.

## Problem

When researching a topic, I would default to keyword-grepping context file contents (e.g. `Select-String -Pattern "onboarding"`). But the keyword I happen to use often doesn't match the actual context file **name** (e.g. the onboarding flow lived in a file named `onboarding-and-manager-applications_2026-08-15.md`, so grepping "apply" or "account" could miss it). Because Glob/Grep skip `.opencode/` and the filename is the only reliable, stable handle into the tree, keyword-first searching hid relevant files and led to them being overlooked.

## Fix

Rewrote the `### IMPORTANT: finding context files` subsection of `AGENTS.md` to make the workflow explicit:

1. **List first** — run `Get-ChildItem -Recurse -Filter *.md -Path ".opencode\context" | Select-Object FullName` to see every context file.
2. **Shortlist by filename** — pick the files to read based on their file names + category folders (the primary signal), not on a guess about what keywords appear inside.
3. **Read, then (optionally) grep** — after shortlisting, read the chosen files; only then grep within them to confirm scope. Avoid content-grep over the whole tree as a first step.

## Files changed

- `AGENTS.md` — updated the `### IMPORTANT: finding context files` guidance.

No existing context files were modified.

## Related files

- The by-path cross-reference and opening-intro conventions this works alongside: `.opencode/context/context-file-conventions/references-and-intro_2026-08-28.md` and `.opencode/context/context-file-conventions/by-path-reference-pass_2026-08-28.md`.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
