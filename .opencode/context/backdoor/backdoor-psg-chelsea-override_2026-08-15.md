# Backdoor Override — Chelsea absent (PSG vs Chelsea, 9 Aug)

## Problem
A backdoor loss (Chelsea absent) was owed for the 09 Aug PSG vs Chelsea fixture,
but that fixture was already `confirmed` with a normal result (PSG 1-3 Chelsea),
so it needed an override rather than a fresh submission.

## Fix
One-off script `scripts/backdoor-chelsea-loss-9aug.ts` (override path), mirroring
the WhatsApp admin backdoor override flow (`handleBackdoorSide` with `isOverride`):

- Fixture `2a336012-85ec-4369-810f-0e9158d3f5ff` (MD624, EFA Premier League)
- Result: **Paris Saint Germain 3-0 Chelsea** (`override_reason = 'backdoor override'`).
- Re-inserts a `result_confirmations` row, upserts the result, keeps the fixture
  `confirmed`, voids pending `backdoor_submissions`, notifies both managers,
  writes an `audit_log` `finalise_result` entry (`away_absent: true`).
- Calls `recalculateStandings('35adbc8e-...')` — league type; upsert on an existing
  row does NOT re-fire the `on_result_insert` standings trigger, so the full
  rebuild is required (26 rows written, 650 fixtures processed).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
