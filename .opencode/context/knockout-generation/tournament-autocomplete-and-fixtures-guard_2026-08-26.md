# Tournament auto-completion + Generate Fixtures guard

Date: 2026-08-26
Chain: `knockout-generation/` (follow-up to `super-cup-bugfix_2026-08-26.md`)

## Problems

### 1. Tournaments stay "active" after all fixtures are played

Super cup (and presumably other non-league tournament types) remained `active` even
after the last fixture was confirmed. The `status` field was only set to `'completed'`
in two places:
- `awardTrophy()` — only fires when a knockout **final** round_type is confirmed
- Manual "End Season" admin action — only covers league tournaments

No mechanism existed to detect completion for non-knockout tournament types (e.g.
super cup with a single `final` fixture, or any tournament where all fixtures are
played but `advanceWinner` didn't hit the final path).

### 2. "Generate Fixtures" button had no frontend guard

`GenerateKnockoutsButton` already had a clean frontend guard — shows a static green
"Knockouts Generated ✓" badge when knockouts exist (the `hasKnockouts` prop introduced in
.opencode/context/knockout-generation/knockout-autogen-removal_2026-08-23.md).
`GenerateFixturesButton` had **no** such guard: it always showed the clickable button,
with the 409 error only appearing as small red text below the button (easy to miss).

## Fix

### Auto-completion: `checkTournamentCompletion()` in `lib/tournament-progression.ts`

New async function that:
1. Loads tournament `type` and `status`
2. Skips if status is not `active` or type is `league` (leagues use explicit
   "End Season" which also handles qualification notifications + manager tenures)
3. Counts total fixtures vs pending (not confirmed/abandoned)
4. If zero pending, updates tournament status to `completed`

Called from **both** exit paths of `advanceWinner()`:
- The `if (!progression)` early-return path (finals / non-knockout fixtures)
- The end of the function after filling the next fixture slot

### Fixtures guard: `hasFixtures` prop on `GenerateFixturesButton`

Added `hasFixtures?: boolean` prop. When true, renders a static green badge
"Fixtures Generated ✓" (matching the knockouts badge style) instead of the
clickable button.

Passed from all consumers:
- `app/(admin)/admin/dashboard/_desktop.tsx` — `hasFixtures={fixtureCount > 0}`
- `app/(admin)/admin/tournaments/_desktop.tsx` — `hasFixtures={fc > 0}`
- `app/(admin)/admin/tournaments/_mobile.tsx` — `hasFixtures={fixtureCount > 0}`
- `app/(admin)/admin/tournaments/[id]/page.tsx` — `hasFixtures={fixtureCount > 0}`
  (also added GenerateFixturesButton to the detail page, which previously lacked it)

## Key files

| File | Change |
|------|--------|
| `lib/tournament-progression.ts` | Added `checkTournamentCompletion()`, called from `advanceWinner()` |
| `app/(admin)/admin/tournaments/GenerateFixturesButton.tsx` | Added `hasFixtures` prop + badge UI |
| `app/(admin)/admin/dashboard/_desktop.tsx` | Pass `hasFixtures` to TournamentCard |
| `app/(admin)/admin/tournaments/_desktop.tsx` | Pass `hasFixtures` per row |
| `app/(admin)/admin/tournaments/_mobile.tsx` | Pass `hasFixtures` per card |
| `app/(admin)/admin/tournaments/[id]/page.tsx` | Added GenerateFixturesButton + pass `hasFixtures` |

## Design decision: leagues excluded from auto-completion

League tournaments are intentionally excluded from `checkTournamentCompletion`.
Their completion is gated behind the manual "End Season" button which also:
- Validates all fixtures are confirmed
- Sends qualification notifications
- Auto-ends manager tenures
- Marks the season as completed
- Audit logs the action

Auto-completing leagues would bypass all of that side-effect logic.

## Related files

- Follow-up to .opencode/context/knockout-generation/super-cup-bugfix_2026-08-26.md
  and .opencode/context/knockout-generation/auto-super-cup-generation_2026-08-25.md
  (completion detection extends the `advanceWinner`/Super Cup work).
- The `hasFixtures` guard mirrors `GenerateKnockoutsButton.hasKnockouts` from the chain root:
  .opencode/context/knockout-generation/knockout-autogen-removal_2026-08-23.md.
