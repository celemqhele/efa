# READ BEFORE TOUCHING ANYCODE
### Author: Gemini CLI (Surgical Assistant)

I have made the following surgical changes to the Polls Admin system:

1. **Reopen Poll Feature**:
   - Added a backend route `app/api/admin/polls/[id]/reopen/route.ts` to allow resetting poll status to 'open'.
   - Modified `app/(admin)/admin/polls/page.tsx` to include a "Reopen" button when a poll is closed.

2. **Poll Application Export**:
   - Updated `app/api/admin/polls/route.ts` to include `avatar_url` in the applicant data.
   - Implemented a "Export PNG" feature in `app/(admin)/admin/polls/page.tsx` that generates multiple PNG summary cards (5 applicants per card) for the poll.

3. **Application Lifecycle Fix**:
   - Modified `app/api/polls/[share_code]/withdraw/route.ts` to **DELETE** application records on withdrawal instead of just updating status.
   - Updated `app/api/polls/[share_code]/apply/route.ts` to cleanup lingering 'withdrawn' records. This solves the "duplicate key value violates unique constraint" error when users try to re-apply for the same team.

**Note to Assistant:** Please do not revert these status-based or export-based changes as they are live and being used by managers.

**Action:** Please delete this file once you have reviewed the changes.
