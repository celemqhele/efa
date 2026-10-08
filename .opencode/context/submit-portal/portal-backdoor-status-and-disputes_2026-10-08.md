# Portal: backdoor status card + dispute (appeal) flow

Adds a status card for a manager's own backdoor claim (pending / approved /
declined, with Cancel while pending) and a DISPUTE action for the manager who
was reported: they upload their own screenshot plus a written explanation to
appeal a backdoor that has already been applied, and the admin decides it on
the existing backdoor review page — upholding awards the disputer a 3-0 win,
declining leaves the applied result alone. Follows
`.opencode/context/submit-portal/portal-result-resubmit-and-backdoor_2026-10-08.md`,
which had made an approved backdoor result replaceable again.

## Problem
- Opening `/submit-match/[code]` after filing a report rendered the empty
  report form again (and it could not be submitted), so a manager never saw
  whether their claim was still pending, approved or declined, and had no way
  to withdraw it.
- The manager named as not responding could see nothing: no red warning, no
  view of the opponent's proof, and once the admin had applied the 3-0 there
  was no way to rebut it. The WhatsApp bot had no appeal path either — the
  result simply stood.

## Design decisions
- **A dispute is stored as a normal `backdoor_submissions` row** with new
  `is_dispute` / `dispute_note` columns rather than a new table, so the admin
  review page already groups both screenshots per fixture, the approve/decline
  API and bot flow keep working, and the existing expiry cron cleans up stale
  disputes.
- **`side_claimed` on a dispute points at the ORIGINAL reporter's side**, so
  the existing approve logic ("3-0 to the side opposite `side_claimed`") hands
  the original reporter the 0-3 loss and the disputer the 3-0 win with no new
  score maths.
- **Dispute is only available after the report was APPLIED** (`approved`). A
  pending report is not appealable — the admin has not decided yet — and the
  portal says so.
- Expiry: a dispute uses the same next-Tuesday 23:59:59 window as a report, so
  `expire-backdoor-submissions` retires it like any other row.

## Fix

### `supabase/migrations/097_backdoor_disputes.sql`
- `alter table public.backdoor_submissions add column if not exists is_dispute
  boolean not null default false;` + `dispute_note text;` with column comments.
- Applied with `npm run db -- supabase/migrations/097_backdoor_disputes.sql`,
  then `npx tsx scripts/backfill-migration-history.ts` so
  `supabase_migrations.schema_migrations` shows `097 / backdoor_disputes`.
  Grants are unchanged (column-level privileges follow the table's).

### `lib/submit-match.ts`
- Exported `isMineSubmission(row, viewer)` (normalised phone digits, else user
  id) so the API route can use the same ownership test.
- `buildState` selects `reviewed_at, is_dispute, dispute_note` on the fixture's
  rows and derives three views:
  - `myBackdoorRow` — first `pending/approved/declined` row filed by the viewer.
  - `reportsAgainstMe` — `pending|approved` rows where
    `side_claimed === viewer.side` and `!isMineSubmission` (i.e. the opponent's
    claim against this side).
  - `disputableReports` — the subset already `approved`.
- New `rules.disputeBlock` chain (first match wins): admin/no side → placeholder
  → abandoned → no report against me → report still pending → own dispute
  decided (per status) → own report still pending (cancel it first) → own report
  decided → every disputable row is already a dispute. `rules.canDispute =
  disputeBlock === null`.
- `rules.backdoorMenuBlock = backdoorBlock && !myBackdoorRow && disputeBlock
  ? backdoorBlock : null` — menu item 2 stays clickable while a claim exists
  (status card) or a dispute can be filed.
- Returned `myBackdoor` (with `isDispute`/`disputeNote`), `reportsAgainstMe`
  (with `isDispute`), `backdoorMenuBlock`, `disputeBlock`, `canDispute`.

### `app/api/submit-match/route.ts`
- New actions `backdoorCancel` and `backdoorDispute`.
- `cancelBackdoor` re-selects the fixture's rows, checks ownership via
  `isMineSubmission` and `status === 'pending'`, deletes the row, audits
  `portal_dispute_cancelled` / `portal_backdoor_cancelled`. Success responses
  carry no `shareLink`/`shareText`.
- `disputeBackdoor` validates: viewer has a side, screenshot present (≤8MB),
  explanation 5–500 chars, not postponed/abandoned; re-derives
  `reportsAgainstMe`/`appliedAgainstMe` server-side (pending report → "only once
  the backdoor has been applied"); blocks a second live dispute or an own live
  report; uploads to `backdoor-screenshots` as `dispute-<ts>.jpg`; inserts with
  `side_claimed = opposite of viewer` (the original reporter), `is_dispute: true`,
  `dispute_note`, next-Tuesday expiry; notifies admins via
  `notifyBackdoorDisputed` and the original reporter in-app
  ("your opponent disputed your report").
- `submitResult`'s approved-backdoor probe changed from `.maybeSingle()` to
  `.limit(1)` + length check, because two approved rows (report + upheld
  dispute) are now possible and `.maybeSingle()` errors on 2 rows.

### `lib/backdoor-notify.ts`
- New `notifyBackdoorDisputed` → admin browser push + in-app row, deep-linked to
  `/admin/backdoor-submissions`.
- `notifyBackdoorDecision` now also notifies the ORIGINAL reporter on a dispute
  decision: mirror outcome (`backdoor_declined` "dispute upheld, your report did
  not stand" / `backdoor_approved` "dispute declined, your report stands").

### `app/api/admin/backdoor/approve/route.ts`
- Selects `is_dispute`; when the batch includes a dispute, flips the fixture's
  other `approved` non-dispute report to `declined` so only one outcome stands.
- `result_confirmations` insert → **upsert on `fixture_id,submitted_by`**: that
  table is `UNIQUE (fixture_id, submitted_by)` (migration 034), and a dispute is
  always approved AFTER the report it answers already wrote a row by the same
  admin — a plain insert would 500 on the constraint.
- Approved row update / pending-row voiding / standings + `advanceWinner`
  untouched.

### `app/api/webhook/route.ts` (bot)
- Same `result_confirmations` insert → upsert in the admin approve path (the bot
  always uses admin `celemqhele`, so the second decision would collide).
- The dispute counter-report flip added there too.
- Labelling only: `showUserBackdoorApplications` prefixes `⚖️ Dispute - `;
  `showBackdoorSubmissionsForReview` marks the fixture line `DISPUTE filed by …`
  and the detail messages `DISPUTE by <phone>` + the explanation, so an admin
  reviewing on WhatsApp knows it is an appeal.

### `app/(admin)/admin/backdoor-submissions/*`
- `page.tsx` selects `is_dispute, dispute_note`.
- `BackdoorSubmissionsClient.tsx`: `Submission` gains both fields; a fixture with
  a dispute gets a `⚖️ Dispute review` tag (pulsing while one is pending); the
  dispute row is rendered with an indigo left border + `⚖️ Dispute` badge, the
  explanation in its own block, and a line explaining that upholding gives the
  disputer 3-0 while rejecting keeps the result. Buttons relabel to
  `Uphold dispute (3-0)` / `Reject · keep result`. `pendingIds` for the
  `Approve both (0-0)` button now excludes disputes, which are always an
  individual decision.

### `app/submit-match/[code]/_portal.tsx`
- `BD_STATUS` map (label + tone) for the badge; new `formatDateTime` helper.
- Menu item 2 sub: `Your report|dispute: <status>` when a claim exists, or
  `<opponent> reported you — view the proof and dispute it` when a dispute is
  available, else the original screenshot-proof line; block now
  `rules.backdoorMenuBlock`.
- `BackdoorPanel` (props `disputeBlock`, `myBackdoor`, `reportsAgainstMe`):
  - dispute mode: explainer + screenshot + explanation textarea (5–500) +
    `backdoorDispute`, Back button.
  - status card when `myBackdoor`: status badge, per-kind outcome line
    (dispute upheld / declined / with the admin; report approved 3-0 / declined),
    submitted time, own explanation + screenshot links, and a two-step
    `Cancel dispute|report` for pending rows.
  - otherwise the original report form, still honouring `block`.
  - `ReportedNote` always appended: red warning card per report against the
    viewer with the correct headline/warning for a plain report vs a dispute
    against them, `View screenshot`, and the `Dispute` button only when applied
    and `canDispute` (otherwise the `disputeBlock` reason).
- `DetailsPanel` backdoor list prefixes `Dispute · ` and shows the explanation.

## Verification
- `npx tsc --noEmit` clean.
- `npx next lint` on the edited files: only pre-existing unused-var warnings.
- DB: `information_schema` confirms `is_dispute boolean not null default false`
  and `dispute_note text`; `supabase_migrations.schema_migrations` has `097`.

## Files changed
- `supabase/migrations/097_backdoor_disputes.sql` (new)
- `lib/submit-match.ts`
- `lib/backdoor-notify.ts`
- `app/api/submit-match/route.ts`
- `app/api/admin/backdoor/approve/route.ts`
- `app/api/webhook/route.ts`
- `app/(admin)/admin/backdoor-submissions/page.tsx`
- `app/(admin)/admin/backdoor-submissions/BackdoorSubmissionsClient.tsx`
- `app/submit-match/[code]/_portal.tsx`
