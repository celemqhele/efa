# Manager Cooldown Override — tournament creation flow fix

Follow-up fix to the cooldown override introduced in
`.opencode/context/onboarding/manager-cooldown-override_2026-08-17.md`.
The user reported that clicking "Override" did nothing when assigning a
recently-sacked manager inside the **Create / Manage Season** (tournament creation)
flow, whereas the same button worked on a team's page.

## Problem

In `app/(admin)/admin/seasons/SeasonManager.tsx`, the `SackCooldownDialog`'s
`onOverride` handler guarded on `assigningTeamId` to re-locate the target team:

```ts
onOverride={() => {
  if (cooldown && assigningTeamId) { ... }
}}
```

But `assigningTeamId` is reset to `null` in the `finally` block of the
`onChange` handler that fired the assign `fetch`. So by the time the cooldown
dialog was open, `assigningTeamId` was already `null`, making the override a
silent no-op: the dialog stayed open, no request was sent, and no error appeared.
The Managers admin page (`ManagersClient.tsx`) and the team page
(`TeamManagerAdmin.tsx`) were unaffected because they re-run their own
`handleAssign(…, true)` directly instead of relying on that state.

## Fix

Store the target team inside the cooldown state so the override no longer depends
on the transient `assigningTeamId`.

1. Extended the `cooldown` state type to carry the team id:
   `{ username; cooldownEndsAt; teamId?: string | null }`.
2. Populate `teamId` (the team's `id`) when the `SACK_COOLDOWN` response opens the dialog.
3. Rewrote `onOverride` to re-locate the team from `allTeams` via `cooldown.teamId`
   instead of relying on `assigningTeamId`, then send the assign request with
   `override: true` (unchanged payload/behaviour). `allTeams` lookups use the
   non-null `id`, avoiding the `logo_team_slug` `string | null` type friction that
   a stored-snapshot approach introduced.

## Related files

- `app/(admin)/admin/seasons/SeasonManager.tsx`
- Original override feature: `.opencode/context/onboarding/manager-cooldown-override_2026-08-17.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
