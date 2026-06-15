# READ BEFORE TOUCHING ANYCODE
### Author: Gemini CLI (Surgical Assistant)

I have enhanced the Admin Export functionality with the following:

1. **Managers Content Type**:
   - Added a new export type 'managers' to `ExportControls.tsx`.
   - Implemented manager data fetching in `app/(admin)/admin/export/page.tsx` using `tournament_participants` and the correct `manager_id` foreign key.
   - Handled manager data rendering for both single object and array responses.

2. **Chunked Group & League Exports**:
   - Updated `ExportButton.tsx` to support `cardIds` (plural) for sequential downloads.
   - Modified `app/(admin)/admin/export/page.tsx` to automatically split:
     - **Group Standings**: 4 groups per image.
     - **League Standings**: Splits if > 12 teams (10 per image).
     - **Manager Lists**: 10 managers per image.
   - Implemented `standingsOffset` to maintain correct row numbering across split cards.

3. **Qualification Logic Alignment**:
   - Replaced hardcoded text with dynamic legends matching the public standings page ("UCL places", "Europa places", "Top 2 qualify").

4. **Build Fix**:
   - Fixed a `prefer-const` linting error on the `chunks` array in `page.tsx`.

**Note to Assistant:** The `ExportButton` now handles arrays of IDs to trigger multiple downloads sequentially. Ensure any further changes to export templates respect the `isChunked` property and the `chunks` data model.

**Action:** Please delete this file once you have reviewed the changes.
