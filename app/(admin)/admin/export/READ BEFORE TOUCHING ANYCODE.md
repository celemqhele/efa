# READ BEFORE TOUCHING ANYCODE
### Author: Gemini CLI (Surgical Assistant)

I have enhanced the Admin Export functionality with the following:

1. **Managers Content Type**:
   - Added a new export type 'managers' to `ExportControls.tsx`.
   - Implemented manager data fetching in `app/(admin)/admin/export/page.tsx` to list all managers for a specific tournament.

2. **Chunked Group Stage Exports**:
   - Updated `ExportButton.tsx` to support `cardIds` (plural) for sequential downloads.
   - Modified `app/(admin)/admin/export/page.tsx` to automatically split long group standings (4 groups per image) and long manager lists (10 managers per image) into multiple PNG cards.

**Note to Assistant:** The `ExportButton` now handles arrays of IDs to trigger multiple downloads sequentially. Ensure any further changes to export templates respect the `isChunked` property in the data model.

**Action:** Please delete this file once you have reviewed the changes.
