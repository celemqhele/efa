# Direct Result Submissions (Al Ettifaq vs Nantes)

## Problem
Admin "Submit Result" in the app returned **"Fixture not found"** when trying to finalise results. User asked to submit the results directly instead.

## Fix
Submitted two group-stage results directly against the DB using standalone scripts (service-role client, same pattern as `scripts/postpone-*.ts`):

1. **Al Ettifaq 3–2 Nantes** — fixture `04bed437-0998-456f-8c3c-641e19c007bb` (UCL MD11, Group B)
   - Script: `scripts/submit-al-ettifaq-nantes-result.ts`
2. **Nantes 1–3 Al Ettifaq** (return leg) — fixture `c31b254d-f624-4cdd-ab20-e9eb82165f64` (UCL MD41, Group B)
   - Script: `scripts/submit-nantes-al-ettifaq-result.ts`

Each script:
- Upserts the result (`is_abandoned = false`, `finalised_by = celemqhele` admin id).
- Voids pending `backdoor_submissions` for the fixture.
- Inserts `result_confirmed` notifications for both team managers.
- Writes an `audit_log` `finalise_result` entry.

## Notes / Gotchas
- The `on_result_insert` trigger (migration 003) **does NOT set fixture status to `confirmed` for `round_type = 'group'`** — it `RETURN`s early after updating `group_standings`. The admin route handles this with a fallback `UPDATE fixtures SET status = 'confirmed'`. Scripts replicate that fallback.
- Setting the fixture to `confirmed` fires `on_fixture_confirmed` (migration 037), which inserts the "Result Confirmed" notification for all admins — expected, matches app behaviour.
- "Fixture not found" from the app was likely a stale/deleted fixture ID (recent fixture regeneration/postponement work); the exact API query returns existing fixtures fine. Not reproduced for these two fixtures.
- 28 group fixtures still pending in UCL, so no knockout generation was triggered.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
