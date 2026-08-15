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

Context files live in `.opencode/context/`, grouped into category folders.

### IMPORTANT: finding context files
The Glob/Grep file tools SKIP hidden/dot-directories, so `.opencode/` is invisible to
them (`glob(".opencode/context/**/*.md")` returns nothing). To list/search context files
you MUST use the shell or the Read tool instead:
```powershell
Get-ChildItem -Recurse -Filter *.md -Path ".opencode\context" | Select-Object FullName
Get-ChildItem -Recurse -Filter *.md -Path ".opencode\context" | Select-String -Pattern "keyword" -SimpleMatch
```

### Category folders

- `whatsapp/` — WhatsApp/webhook bot flows
- `fixtures/` — fixture scheduling and postponement
- `notifications/` — notification sounds and triggers
- `results/` — result submission and admin results pages
- `stats/` — stats/trigger fixes
- `ui/` — frontend/UI changes

### Naming requirement
Every context file MUST be named `topic_YYYY-MM-DD.md`, where `YYYY-MM-DD` is the file's last-modified date. New files use the current date. When a file is substantially edited on a later day, rename it to the new date.

### Placement rule
When creating a new context file, place it in the relevant category folder above. If none of the categories fit, create a NEW category folder (lowercase single word, e.g. `auth/`) and add it to the list above.
