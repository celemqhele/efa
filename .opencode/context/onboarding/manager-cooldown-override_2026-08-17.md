# Manager Cooldown Override

## Problem
Admin team assignment was blocked by a 7-day cooldown after sacking a manager. Admins had no way to bypass this if they needed to reassign a manager immediately.

## Fix
Added an "Override" capability to bypass the 7-day sack cooldown.

1. **API**: Updated `POST /api/admin/managers/assign` to accept an `override: boolean` parameter. If true, the cooldown check is bypassed.
2. **UI**:
   - Added an `onOverride` prop to `SackCooldownDialog`.
   - Included an "Override" button in the dialog that triggers the API with `override: true`.
   - Updated `TeamManagerAdmin.tsx`, `ManagersClient.tsx`, and `SeasonManager.tsx` to pass the `onOverride` handler.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |