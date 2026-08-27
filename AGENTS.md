# AGENTS.md — Instructions for AI agents working in this repo

## Supabase — you CAN run SQL directly (don't ask the user to paste SQL)

You have direct, working access to the remote Supabase Postgres database from the terminal. Use it. Never tell the user "go paste this in the SQL Editor."

### How to run SQL on Supabase

```bash
npm run db -- path/to/migration.sql   # run a SQL file
echo "SELECT 1;" | npm run db         # run SQL from stdin
npm run db -- -c "SELECT 1;"          # run a SQL string
```

- Reads the connection string from `.env.supabase` (gitignored, `SUPABASE_DB_URL`).
- Uses `scripts/db.ts` (node + `pg` via `tsx`). No psql/docker needed.
- The DB password lives in `.env.supabase`. If it has `PASSWORD_HERE`, ask the user to paste the full connection string from Dashboard → Project Settings → Database → Connection string, then fill it in.

### Data reads (no schema change) — REST API with secret key

Schema changes (DDL) need `npm run db`. For plain queries you can also use the REST API with the secret key, but prefer `npm run db` for consistency.

Project ref: `dtxnqtfqsehofezdmdbd`

## File Deletion Policy
**NEVER permanently delete files.** 
Whenever a file needs to be removed:
1. Move it to the `.recycle/` directory instead of using `rm` or `Remove-Item`.
2. Update the "Restore File Section" in the corresponding `.opencode/context/**/*.md` file with:
   - Original path
   - Purpose of the file
   - New path inside `.recycle/`
3. Commit the move and the updated context file.

## Context Files — organization rules

Context files live in `.opencode/context/`, grouped into category folders. Each folder groups a related feature/topic. **Each change or modification gets its own new context file — never update an existing context file with new info**, because editing an existing file erases the old content that may still be useful. New files are added per change so history is preserved.

### IMPORTANT: finding context files
The Glob/Grep file tools SKIP hidden/dot-directories, so `.opencode/` is invisible to
them (`glob(".opencode/context/**/*.md")` returns nothing). To list/search context files
you MUST use the shell or the Read tool instead:
```powershell
Get-ChildItem -Recurse -Filter *.md -Path ".opencode\context" | Select-Object FullName
Get-ChildItem -Recurse -Filter *.md -Path ".opencode\context" | Select-String -Pattern "keyword" -SimpleMatch
```

### Category folders

- `check-fixtures/` — WhatsApp check-fixtures flow (phone-update, auto-detect, contact card, session close)
- `whatsapp-results/` — WhatsApp result-submission flow (readable dates, already-submitted handling)
- `onboarding/` — WhatsApp onboarding + admin manager-assignment + team-change requests
- `backdoor/` — backdoor admin flow (WhatsApp override, review page, dashboard link, one-off scripts)
- `fixture-scheduling/` — fixture scheduling and postponement
- `admin-results/` — admin result submission (submit page, direct DB submissions)
- `notification-sounds/` — notification sounds and triggers
- `manager-stats/` — manager stats/trigger fixes
- `efootball-teams/` — eFootball 2027 team restriction and follow-up fixes
- `home-upcoming-widget/` — home page Upcoming widget
- `uel-no-name/` — UEL "No Name" placeholder team replacement + ShieldQuestion logo fallback
- `admin-dashboard/` — admin dashboard UI (tournaments widget button uniformization, postpone overlay)
- `migration-history/` — Supabase schema_migrations tracking / migration bookkeeping
- `forfeit-balances/` — forfeit balance carry-over (website "Use" button, WhatsApp auto-apply)
- `postgrest-embeds/` — PostgREST embed shape issues (unique constraints flipping embeds to one-to-one)
- `knockout-generation/` — knockout bracket generation + progression wiring (advanceWinner, leg mirroring, tie-breaks)
- `season-cup-flow/` — deferred cup creation after league end (start-tournament flow)
- `south-african-premiership/` — South African Premiership (Betway Premiership) league addition
- `deploy-performance/` — Vercel deployment performance / middleware timeout fixes

### Naming requirement
Every context file MUST be named `topic_YYYY-MM-DD.md`, where `YYYY-MM-DD` is the file's creation date (a new file always uses the current date). A context file is written once and never updated; a later change or fix on the same topic gets a brand-new file with the new date.

### Placement rule
When creating a new context file for a change, decide whether it relates to an existing category or is brand-new:
- **Related to an existing category** (a follow-up problem/change on something already documented) → create a brand-new file (new date) in that existing category folder. Never append to the existing file.
- **Brand-new topic** → create a new category folder (kebab-case theme name, e.g. `auth/`) and add it to the list above. This is only allowed when the file is unrelated to every existing category — never create a folder just to isolate a single file that could join an existing chain.
