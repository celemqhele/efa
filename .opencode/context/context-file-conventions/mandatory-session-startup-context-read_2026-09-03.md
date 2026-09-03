# Context File Conventions — Mandatory session-startup context read

## Intro
Added a bold session-startup blockquote to the very top of `AGENTS.md` requiring every
new session to list and read context files before doing anything else. This addresses
the recurring problem where agents start new sessions without bootstrapping on prior
work, leading to redundant or conflicting changes.

## Problem
The existing context-file rules ("Each change gets its own new context file" and
"List-first, then shortlist") describe *how* to use context files, but there was no
rule forcing agents to actually read them at session start. In practice, sessions
would sometimes skip this step entirely — especially if the user's first message was
a direct task rather than a question about prior work.

## Fix
Added a `> SESSION STARTUP` blockquote at the very top of `AGENTS.md` (line 3), right
after the title. The rule:
- Lists the exact shell command to discover all context files
- Requires reading the relevant ones before answering the user's first question
- Warns that skipping this leads to redundant/conflicting changes

### Files changed
- `AGENTS.md` — added session-startup context-read blockquote at top

## Notes / Gotchas
- The blockquote is the very first thing in the file after the title, so it's the
  first rule any agent reads — impossible to miss even if the agent skims.

## Related files
- `AGENTS.md` — the rules file, top of file
- `AGENTS.md` line 39 — the mandatory context-file creation rule added earlier today
  (`.opencode/context/context-file-conventions/mandatory-context-file-rule_2026-09-03.md`)

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
