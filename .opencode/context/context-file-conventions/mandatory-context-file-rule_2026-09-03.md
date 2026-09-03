# Context File Conventions — Mandatory context-file rule enforcement

## Intro
Added a bold, non-negotiable enforcement block to `AGENTS.md` under "Context Files —
organization rules" to guarantee every session creates a context file before committing.
The prior wording ("Each change or modification gets its own new context file") was
correct but easy to overlook during implementation; the new blockquote rule is
impossible to miss.

## Problem
The existing context-file rule was a single paragraph buried in the middle of the
Context Files section. In practice sessions would sometimes skip context-file creation,
resulting in changes being committed without a corresponding record in `.opencode/context/`.

## Fix
Added a `> MANDATORY` blockquote immediately after the existing context-file paragraph
in `AGENTS.md` (line 39). The rule explicitly requires:
- A new context file for every code edit/add/remove — no exceptions
- The context file must be written **before** committing
- A session that skips this is considered incomplete

### Files changed
- `AGENTS.md` — added mandatory context-file enforcement blockquote

## Notes / Gotchas
- The new blockquote is visible both in raw Markdown and in rendered form, making it
  harder for future sessions to miss compared to inline bold text.

## Related files
- `AGENTS.md` — the rules file, specifically the "Context Files — organization rules" section

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
