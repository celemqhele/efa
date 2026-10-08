# Portal: postpone status visibility + 7-day-after-deadline postpone window

Two linked portal/fixture-page changes shipped together: (1) the postponement status is now readable for ANY viewer of a match link (admins opening a manager's link can see whether a request is pending, accepted, or declined, and by which manager); (2) managers now have a new permission — 7 days AFTER the match deadline to complete a postponement (requester can file, reviewer can accept/decline), even if the cron already auto-finalised the game to a placeholder.

## Problem
- An admin clicking another manager's match link saw the Postpone section greyed out (blocked) with no way to tell whether a request was made, accepted, or declined — no request status was surfaced. (Reported by the user: "i can't tell whether it was requested, accepted, rejected, postponed... maybe add the part where you can actually see the status as the admin".)
- Independently, the user requested a new rule: "they have 7 days after deadline to postpone (reqester) or accept or decline (reviewer) to complete a postpone". Previously the deadline period was the only window: once the daily 02:00 SAST auto-finalise cron (`app/api/cron/auto-finalise-prev-day/route.ts`) turned an unplayed match into a confirmed 0-0 / auto-approved backdoor result, `postponeBlock` (`fixture.result` / status checks) closed the postpone option permanently and no request could be filed.

## Fix
### Postpone status visibility
- `lib/submit-match.ts` `buildState` (around line 246): added `postponeRequest` object to state with `id, status, newDate, reason, requestedBy, requestedByName` (via `usernameLabel`), `mine`, `respondedBy, respondedByName`.
- `app/submit-match/[code]/_portal.tsx`: header now renders banners for
  - postponed·confirmed (`state.postponedConfirmed`): "Postponed · confirmed — requested by {name}" + "Moved to {date} · accepted by {responder}".
  - pending request: "Postponement requested by {name} to {date}. Waiting on the opponent's answer." + reason.
  - declined: "Postponement to {date} was declined by {name}." + reason.
  - DetailsPanel postpone line uses requester/responder names too.
- `app/(public)/fixtures/[id]/page.tsx`: `loadFixture` + an added `postpone_requests` fetch joined `requester:profiles!postpone_requests_requested_by_fkey(id, username)` and `responder:profiles!postpone_requests_responded_by_fkey(id, username)`, latest row passed down as `postponeRequest`.
- `app/(public)/fixtures/[id]/_mobile.tsx` and `_desktop.tsx`: new "Postponement" status card after the hero showing the same three states + names, with a shared local `formatFixtureDate` helper.

### 7-day-after-deadline postpone window
- `lib/submit-match.ts`:
  - Exported `MAX_POSTPONE_DAYS = 7` and `postponeWindow(dateKey, now?)`: returns `null` while `dateKey >= today-7` (the future side is bounded by `MAX_POSTPONE_DAYS` on the proposed new date), else a block message. This is the lower bound only.
  - Exported `isRealResult(result)`: true when the on-file result has `finalised_by` or `screenshot_url` (a real played/admin-recoded game). Auto-finalised placeholders (0-0 void, auto-approved backdoor — both written with `finalised_by: null`, no screenshot) are NOT "real".
  - `buildState` `postponeBlock` now: manager-only/login gates stay; `isPlaceholder` gate stays; then `postponeWindow(dateKey)` block; then `isRealResult(fixture.result)` → "already has a result and is now over the deadline"; then a status `scheduled`/`awaiting_confirmation`/no-result gate. Result: an auto-finalised fixture inside the window is still postponable.
- `app/api/submit-match/route.ts`:
  - `requestPostpone`: imports now include `MAX_POSTPONE_DAYS, isRealResult, postponeWindow`; the status-only guard was replaced with `postponeWindow(dateKeyOf(fixture))` + `isRealResult` + the same status/no-result gate, so a request can be filed inside the window even after auto-finalise.
  - `respondToPostpone`: added the same `postponeWindow` check — the reviewer also gets exactly 7 days after the deadline to accept or decline; past it, a clear error is returned.
  - Removed the local duplicate `const MAX_POSTPONE_DAYS = 7` (now shared from lib).
- `app/api/cron/auto-finalise-prev-day/route.ts`: before finalising, fixtures with a `postpone_requests` row in `status='pending'` are skipped when still inside `postponeWindow` (so the reviewer's window isn't pre-empted); pending requests past the window are deleted (expired) so the fixture still gets auto-finalised instead of hanging forever. Added `skippedPendingRequest` / `expiredPendingRequest` stats. Imported `postponeWindow`.

### Facts / model
- Real submissions write `screenshot_url` + `finalised_by: viewer.userId` (portal `submitResult`) or `finalised_by: adminUserId` (backdoor approve); auto-finalise writes `finalised_by: null` and (0-0 path) `override_reason 'Both teams absent — auto-finalised (0-0, no points)'`. `isRealResult` uses `finalised_by`/`screenshot_url` to tell them apart.
- `postpone_requests.status` CHECK constraint only allows `pending|accepted|declined` — no `expired`, hence stale requests are deleted rather than re-labelled.
- `loadFixture` now also selects `finalised_by` on the embedded result.

## Verification
- `npx tsc --noEmit` clean; `next lint` on the three touched route/lib files clean; `npx next build` passes (a `pages-manifest.json` ENOENT appeared on one build — a stale `.next` rename flake on Windows; a clean rebuild succeeded with the full route table). `public/sw.js` is build-generated and was reverted before commit.
- Deployment = `git push origin main` → Vercel (`efa-fxyk`) — commit message style follows the repo's `fix(...)`/`feat(...)` patterns.

## Files touched
- `lib/submit-match.ts` — `MAX_POSTPONE_DAYS`, `postponeWindow`, `isRealResult`, `postponeRequest` in state, postponeBlock window logic, `finalised_by` in loadFixture.
- `app/api/submit-match/route.ts` — shared window gates in requestPostpone + respondToPostpone.
- `app/api/cron/auto-finalise-prev-day/route.ts` — skip in-window pending requests / expire stale ones.
- `app/submit-match/[code]/_portal.tsx` — status banners + name labels.
- `app/(public)/fixtures/[id]/page.tsx`, `_mobile.tsx`, `_desktop.tsx` — loader join + Postponement status card.