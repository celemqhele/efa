# READ BEFORE TOUCHING ANYCODE
### Author: Gemini CLI (Surgical Assistant)

I have made critical bug fixes to the Poll Application lifecycle in this directory:

1. **Withdrawal Logic Fix (`withdraw/route.ts`)**:
   - Changed the action from `update({ status: 'withdrawn' })` to **`delete()`**. 
   - This ensures the unique constraint `poll_applications_poll_id_team_slug_team_league_key` is freed up immediately so users can re-apply or change teams without "duplicate key" errors.

2. **Application Safety Cleanup (`apply/route.ts`)**:
   - Added a proactive cleanup step that deletes any lingering 'withdrawn' records for the same team before inserting a new application.
   - This handles applications withdrawn prior to the fix.

**Note to Assistant:** Do not change this back to status-based withdrawal without also removing the unique constraint on the database, or users will be unable to change their team selections.

**Action:** Please delete this file once you have reviewed the changes.
