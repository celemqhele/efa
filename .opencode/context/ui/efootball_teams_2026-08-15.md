# eFootball 2027 Team Restriction — 2026-08-15

Restricted all team-picking and assignment surfaces to only include clubs and national teams that exist in eFootball 2027 (v6.0.0).

- **Objective**: Prevent managers from picking/assigning clubs or national teams that do not exist in the actual eFootball 2027 roster.
- **Implementation**:
    - Created canonical allowed-teams dataset in `lib/efootball-2027-teams.json`.
    - Added filter utility `lib/allowed-teams.ts`.
    - Updated `lib/logo-resolver.ts` to include 2026-27/2027 league folders.
    - Applied `filterTeams` to:
        - Season wizard (`app/(admin)/admin/seasons/page.tsx`)
        - Admin team management (`app/(admin)/admin/managers/page.tsx`)
        - Webhook `getTeamsForAssignment` (`app/api/webhook/route.ts`)
        - Polls `buildRegistry` (`app/(public)/polls/[share_code]/page.tsx`)
- **Impact**: Non-game teams are now filtered out of selection UIs. Existing team assignments remain untouched.
