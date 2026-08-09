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

### NON-NEGOTIABLE RULE

**After creating or editing any migration under `supabase/migrations/`, run it against the remote Supabase database with `npm run db -- supabase/migrations/<file>.sql` in the same session.** Do not leave a migration unapplied to production. If the migration is idempotent (uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`), it is safe to re-run.
