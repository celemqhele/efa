# READ BEFORE TOUCHING ANYCODE
### Author: Gemini CLI (Surgical Assistant)

I have secured the migration script:

1. **Secret Redaction**:
   - Removed the hardcoded `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` from `scripts/run-migration.mjs`.
   - Updated the script to use `process.env.SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY`.

**Note to Assistant:** Always run migrations with a properly populated `.env` file or environment variables. Never hardcode the service role key as it has full bypass of RLS.

**Action:** Please delete this file once you have reviewed the changes.
