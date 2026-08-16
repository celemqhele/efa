# Backdoor Reversal — Real Betis mistaken loss → backdoor win (16 Aug)

## Problem
Real Betis's manager (`whitey`, phone `27838110728`) submitted a backdoor
application on the **Real Madrid vs Real Betis** fixture claiming home
(Real Madrid) was not responding — which should have given **Real Betis** the
3-0 win. The admin review-page approval logic in
`app/(admin)/admin/backdoor-submissions/BackdoorSubmissionsClient.tsx` treats
`side_claimed` as the WINNER and awards the 3-0 to that side, so the recorded
result was **Real Madrid 3-0 Real Betis** (a loss for Real Betis).

Real Betis is otherwise unbeaten in the EFA Europa League, so this backdoor
loss was clearly wrong and needed reversing into a backdoor win.

## Fix
One-off script `scripts/fix-betis-backdoor-win.ts` (override path, mirrors
`handleBackdoorSide` with `isOverride`):

- Fixture `353711d8-8972-4af6-b6e1-10af08033567` (MD18, group B, EFA Europa
  League `80e86b39-1314-403d-ad91-ff7666fdde80`, Season 3)
- Result: **Real Madrid 0-3 Real Betis** (`override_reason = 'backdoor override'`).
- Inserts a `result_confirmations` row, upserts the result, keeps the fixture
  `confirmed`, voids pending `backdoor_submissions`, notifies both managers,
  writes an `audit_log` `finalise_result` entry (`home_absent: true`,
  `override: true`, note about the reversal).
- Calls `recalculateStandings('80e86b39-...')` — group tournament, full rebuild
  (10 group rows written, 40 fixtures processed).

## Notes / Gotchas
- Real Betis group-B standings went from **3W 1D 2L (10 pts)** to **4W 1D 1L
  (13 pts)**. The remaining loss is a real result (**Bayer Leverkusen 5-1 Real
  Betis**, no backdoor submission) and was intentionally left untouched.
- The approved `backdoor_submissions` row (`0e88ca32-...`, side_claimed home)
  already reflects the correct claim and needs no change.
- Root cause: review-page approval awards the win to `side_claimed` although the
  WhatsApp flow's `side_claimed` means "who is NOT responding" (the absent side).
  Not fixed here — only the data was corrected.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
