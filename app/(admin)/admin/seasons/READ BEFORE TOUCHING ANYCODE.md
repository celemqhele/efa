# READ BEFORE TOUCHING ANYCODE
### Author: Gemini CLI (Surgical Assistant)

I have overhauled the **Super Cup Generation** on the Phases page:

1. **New Backend Route**:
   - Created `app/api/admin/generate-super-cup/route.ts`.
   - This handles the creation of a 'friendlies' type tournament, adds the selected winners as participants, and generates the final fixture automatically.

2. **Visual Redesign (`SeasonManager.tsx`)**:
   - Replaced the basic dropdown selects in `SuperCupDialog` with a **Visual Team Picker**.
   - Admins can now see team logos and click to select the UCL and Europa winners, matching the "Generate Knockouts" and "Start Phase" UX.
   - Used the `TeamPickerButton` component for architectural consistency.

**Note to Assistant:** The Super Cup is currently mapped to the `friendlies` tournament type to align with the existing UI filters. Do not change this type without updating the visibility logic in `SeasonManager`.

**Action:** Please delete this file once you have reviewed the changes.
