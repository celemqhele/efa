# Context File Conventions — Cross-References by Path + Opening Intro

Added two new documented conventions to `AGENTS.md` under the "Context Files — organization rules" section: every context file should open with a short summary paragraph (including, for follow-ups, what the user reported after the earlier change), and any point/issue/action that relates to another context file should reference it by its **full path** instead of prose only.

## What was done
- Added a new **"Opening intro (summary paragraph)"** subsection to `AGENTS.md` (after the Placement rule): a context file starts with a 1-2 sentence intro right under the title — first sentence states the change at a glance; for a follow-up file, one sentence notes what the user reported *after* the earlier change (regression / newly-surfaced issue) so the reader sees how the file connects to the chain.
- Added a new **"Cross-references (by path)"** subsection: reference a related context file by its full path (e.g. `.opencode/context/backdoor/backdoor-betis-win_2026-08-16.md`), applied anywhere relevant — the intro, `## Problem`, and especially the `## Fix` / actions (e.g. "undid what was done in `xyzpath` by doing xyz, then reinstated the previous version created in `xyz2path`"). Rationale: because Glob/Grep silently skip `.opencode/`, a by-path reference is the only reliable way to keep a related file discoverable and solidifies the context chain.
- Both are written as recommended soft conventions, matching the tone of the existing naming/placement rules.
- Both built on patterns already present informally in earlier files (e.g. `uel-no-name-replacement` opens with a summary line; `backdoor-side-inversion` referencing `backdoor-betis-win` by filename; `notification-sounds-mobile` referencing its base file by path).

## Files changed
- `AGENTS.md` — added the two subsections after the Placement rule under "Context Files — organization rules".

No existing context files were modified.
